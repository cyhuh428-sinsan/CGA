"""공유 워크스페이스 컨텍스트 헬퍼(fetchStudioWorkspaceContext/refreshStudioBotSelectedVersion)에
의존하는 기존 주요 화면들의 회귀 테스트.

배경: 시뮬레이터가 `includeDocument=true`로 전체 버전 문서를 요청했지만 쿼리 파라미터가
누락되어(`GET .../context` 호출 시 `include_document`가 비어 있으면 백엔드가 기본값
`False`로 처리) 항상 요약(summary) 응답만 받는 버그가 있었다(커밋 `a97f401`로 재현,
`470b33a`로 수정). 이 파일은 (1) 백엔드의 "전체 문서 vs 요약" 직렬화 계약을 직접 고정하고,
(2) 같은 공유 헬퍼를 호출하는 다른 화면(의도/개체/사전/재학습/평가/봇 운영 워크스페이스/
설정 화면 공급자)이 지금과 같은 인자로 계속 호출되는지 고정해, 향후 이 헬퍼나 그 호출부를
수정할 때 기존 주요 기능이 조용히 깨지는 것을 막는다.
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

from app.api.routes.bots import _serialize_version, _serialize_version_summary


ROOT_DIR = Path(__file__).resolve().parents[3]


def _read(relative_path: str) -> str:
    return (ROOT_DIR / relative_path).read_text(encoding="utf-8")


def _fake_bot_version_with_training_data() -> tuple[SimpleNamespace, SimpleNamespace]:
    bot_id = uuid4()
    version_id = uuid4()
    now = datetime(2026, 5, 4, 15, 43, tzinfo=timezone.utc)
    bot = SimpleNamespace(id=bot_id, active_version_id=None)
    version = SimpleNamespace(
        id=version_id,
        bot_id=bot_id,
        version_no=1,
        name="v1",
        description="테스트 봇",
        status="testing",
        comment="초기 생성 버전",
        copied_from_version_id=None,
        activated_at=None,
        updated_at=now,
        created_at=now,
        version_json={
            "dialogs": [
                {
                    "id": "intent-1",
                    "dialogType": 1,
                    "name": "무동의 계약",
                    "utterances": [{"text": "가입안했어요", "utteranceType": "T"}],
                },
            ],
            "system_config": {"nlu_training": {"status": "success", "intent_count": 1, "utterance_count": 1}},
        },
    )
    return bot, version


# ---------------------------------------------------------------------------
# 1. 백엔드 직렬화 계약: 전체 문서는 반드시 dialogs를 포함하고, 요약은 반드시 제외한다.
# ---------------------------------------------------------------------------


def test_full_version_serialization_includes_version_json_with_dialogs() -> None:
    bot, version = _fake_bot_version_with_training_data()

    payload = _serialize_version(bot, version, db=None, audit_context={})

    assert "version_json" in payload
    assert payload["version_json"]["dialogs"][0]["name"] == "무동의 계약"
    assert payload["version_json"]["dialogs"][0]["utterances"][0]["text"] == "가입안했어요"


def test_summary_version_serialization_excludes_version_json() -> None:
    bot, version = _fake_bot_version_with_training_data()

    payload = _serialize_version_summary(bot, version, db=None, audit_context={})

    assert "version_json" not in payload
    assert payload["is_trained"] is True


# ---------------------------------------------------------------------------
# 2. 백엔드 context 엔드포인트가 prefetch_section=dialogs 단축 경로를 계속 제공하는지 확인.
#    (다른 화면들이 include_document=false로도 dialogs를 받아오는 유일한 경로이므로,
#    이 분기가 제거되면 의도/개체/사전/평가/재학습 화면이 조용히 깨진다.)
# ---------------------------------------------------------------------------


def test_workspace_context_endpoint_still_backfills_dialogs_for_prefetch_section() -> None:
    bots_source = _read("apps/api/app/api/routes/bots.py")

    assert 'prefetch_section == "dialogs"' in bots_source
    assert '"version_json": {\n                    "dialogs": deepcopy(dialogs_payload.get("items")' in bots_source


# ---------------------------------------------------------------------------
# 3. 프론트엔드 호출부 회귀: 공유 헬퍼를 쓰는 기존 주요 화면들이 지금과 같은 인자로
#    호출되는지 고정한다. 헬퍼 시그니처나 호출부가 바뀌면 여기서 즉시 실패한다.
# ---------------------------------------------------------------------------


def test_fetch_workspace_context_always_sends_explicit_include_document_flag() -> None:
    api_source = _read("apps/web/lib/studio-bots-api.ts")

    assert 'search.set("include_document", includeDocument ? "true" : "false");' in api_source


def test_simulator_still_requests_the_full_selected_version_document() -> None:
    simulator_source = _read("apps/web/components/simulator-page.tsx")

    assert "refreshStudioBotSelectedVersion(accessToken, botId, versionId, null, true)" in simulator_source


def test_bot_operations_workspace_keeps_full_document_and_dialogs_prefetch_together() -> None:
    workspace_source = _read("apps/web/components/bot-operations-workspace-page.tsx")

    call_site = workspace_source.split("fetchStudioWorkspaceContext(", 1)[1].split(")", 1)[0]
    assert "true" in call_site
    assert '"dialogs"' in call_site


def test_intent_list_page_still_refreshes_with_summary_only_request() -> None:
    intent_source = _read("apps/web/components/intent-list-page.tsx")

    assert (
        "const refreshed = await refreshStudioBotSelectedVersion(\n"
        "        authSession.access_token,\n"
        "        effectiveBotId,\n"
        "        effectiveVersionName,\n"
        "        effectiveVersion.id,\n"
        "        false,\n"
        "      );"
    ) in intent_source


def test_entity_list_page_still_refreshes_with_summary_only_request() -> None:
    entity_source = _read("apps/web/components/entity-list-page.tsx")

    assert (
        "const refreshed = await refreshStudioBotSelectedVersion(\n"
        "        authSession.access_token,\n"
        "        effectiveBotId,\n"
        "        effectiveVersionName,\n"
        "        effectiveVersion.id,\n"
        "        false,\n"
        "      );"
    ) in entity_source


def test_dictionary_list_page_still_refreshes_with_summary_only_request() -> None:
    dictionary_source = _read("apps/web/components/dictionary-list-page.tsx")

    assert (
        "const refreshed = await refreshStudioBotSelectedVersion(\n"
        "        authSession.access_token,\n"
        "        effectiveBotId,\n"
        "        effectiveVersionName,\n"
        "        effectiveVersion.id,\n"
        "        false,\n"
        "      );"
    ) in dictionary_source


def test_retraining_page_still_refreshes_without_requesting_full_document() -> None:
    retraining_source = _read("apps/web/components/retraining-page.tsx")

    call_site = retraining_source.split(
        "const refreshed = await refreshStudioBotSelectedVersion(", 1
    )[1].split(");", 1)[0]
    assert "true" not in call_site


def test_evaluation_page_still_refreshes_without_requesting_full_document() -> None:
    evaluation_source = _read("apps/web/components/evaluation-page.tsx")

    call_site = evaluation_source.split(
        "const refreshed = await refreshStudioBotSelectedVersion(", 1
    )[1].split(");", 1)[0]
    assert "true" not in call_site


def test_studio_workspace_provider_never_requests_full_document_by_default() -> None:
    provider_source = _read("apps/web/components/studio-workspace-provider.tsx")

    assert "const includeDocument = false;" in provider_source
