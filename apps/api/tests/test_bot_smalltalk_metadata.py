from datetime import datetime, timezone
from types import SimpleNamespace

from app.api.routes import bots


def test_apply_smalltalk_item_metadata_sets_create_and_update_values_for_new_item() -> None:
    now = datetime(2026, 6, 18, 14, 0, tzinfo=timezone.utc)
    current_user = SimpleNamespace(login_id="sinsan")

    result = bots._apply_smalltalk_item_metadata(
        {},
        {
            "smalltalk": {
                "enabled": True,
                "items": [
                    {
                        "id": "smalltalk-1",
                        "title": "안녕",
                        "userMessages": ["안녕"],
                        "botMessages": ["안녕하세요"],
                    }
                ],
            }
        },
        current_user,
        now,
    )

    item = result["smalltalk"]["items"][0]
    assert item["createdBy"] == "sinsan"
    assert item["updatedBy"] == "sinsan"
    assert item["createdAt"] == "2026-06-18T14:00:00+00:00"
    assert item["updatedAt"] == "2026-06-18T14:00:00+00:00"


def test_apply_smalltalk_item_metadata_preserves_created_values_for_existing_item() -> None:
    now = datetime(2026, 6, 18, 15, 30, tzinfo=timezone.utc)
    current_user = SimpleNamespace(login_id="sinsan")

    result = bots._apply_smalltalk_item_metadata(
        {
            "smalltalk": {
                "items": [
                    {
                        "id": "smalltalk-1",
                        "createdBy": "creator",
                        "createdAt": "2026-06-10T10:00:00+00:00",
                        "updatedBy": "old-user",
                        "updatedAt": "2026-06-11T10:00:00+00:00",
                    }
                ]
            }
        },
        {
            "smalltalk": {
                "enabled": True,
                "items": [
                    {
                        "id": "smalltalk-1",
                        "title": "안녕",
                        "userMessages": ["안녕"],
                        "botMessages": ["안녕하세요"],
                    }
                ],
            }
        },
        current_user,
        now,
    )

    item = result["smalltalk"]["items"][0]
    assert item["createdBy"] == "creator"
    assert item["createdAt"] == "2026-06-10T10:00:00+00:00"
    assert item["updatedBy"] == "sinsan"
    assert item["updatedAt"] == "2026-06-18T15:30:00+00:00"
