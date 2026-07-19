from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

from app.api.routes import admin, bots, channels
from app.models import ChannelQueueEvent, User


def _queue_event(*, status: str = "queued") -> SimpleNamespace:
    now = datetime.now(timezone.utc)
    return SimpleNamespace(
        id=uuid4(),
        bot_id=uuid4(),
        bot_version_id=uuid4(),
        channel_type=bots.NLU_TRAINING_QUEUE_CHANNEL,
        status=status,
        receive_status="received",
        parameter_json={
            "requested_by_user_id": str(uuid4()),
            "payload": {},
        },
        result_json={"operation": bots.NLU_TRAINING_QUEUE_OPERATION},
        error_message=None,
        created_at=now,
        status_changed_at=now,
        deleted_at=None,
    )


def test_queue_history_masks_training_file_and_token() -> None:
    event = _queue_event()
    event.parameter_json = {
        "token": "secret-token",
        "payload": {"answer_training": {"file_base64": "A" * 32, "title": "문서"}},
    }

    payload = admin._queue_event_payload(event)

    assert payload["token"] == "[MASKED]"
    assert payload["payload"]["answer_training"]["file_base64"] == "[OMITTED:32]"
    assert payload["payload"]["answer_training"]["title"] == "문서"


def test_channel_queue_processor_excludes_training_jobs() -> None:
    class FakeSession:
        statement = None

        def scalars(self, statement):
            self.statement = statement
            return SimpleNamespace(all=lambda: [])

    db = FakeSession()

    result = channels._process_queued_channel_events(db, SimpleNamespace(client=None))

    compiled = str(db.statement.compile(compile_kwargs={"literal_binds": True}))
    assert result == []
    assert "channel_queue_events.channel_type NOT IN ('training')" in compiled


def test_training_worker_records_completed_manifest(monkeypatch) -> None:
    event = _queue_event()
    user = SimpleNamespace(id=uuid4(), login_id="operator", organization_id=uuid4())
    event.parameter_json["requested_by_user_id"] = str(user.id)
    manifest = {"model_path": "model.json", "model": {"trained_at": "2026-07-15T00:00:00+00:00"}}

    class FakeSession:
        def get(self, model, identity):
            if model is User:
                return user
            if model is ChannelQueueEvent:
                return event
            return None

        def add(self, value):
            return None

        def commit(self):
            return None

        def rollback(self):
            return None

    monkeypatch.setattr(
        bots,
        "_run_version_nlu_training",
        lambda **kwargs: {"data": manifest, "meta": {"request_id": "queue"}},
    )

    result = bots._process_nlu_training_queue_event(FakeSession(), event)

    assert event.status == "completed"
    assert event.receive_status == "completed"
    assert event.result_json["manifest"] == manifest
    assert result["manifest"] == manifest


def test_recover_interrupted_training_job_returns_it_to_queue() -> None:
    event = _queue_event(status="processing")

    class FakeSession:
        def scalars(self, statement):
            return SimpleNamespace(all=lambda: [event])

        def add(self, value):
            return None

        def commit(self):
            return None

    recovered = bots.recover_interrupted_nlu_training_events(FakeSession())

    assert recovered == 1
    assert event.status == "queued"
    assert event.receive_status == "received"
    assert event.result_json["recovery_reason"] == "nlu_training_worker_restarted"
