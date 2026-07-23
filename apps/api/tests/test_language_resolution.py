from app.core.language import language_candidates, normalize_supported_language
from types import SimpleNamespace

from app.api.routes.channels import (
    ChannelMessageRequest,
    ChannelRoomCreateRequest,
    _message_language_candidates,
)


def test_normalizes_supported_region_codes() -> None:
    assert normalize_supported_language("en-US") == "en"
    assert normalize_supported_language("ja-JP") == "ja"
    assert normalize_supported_language("zh-CN") == "zh-CN"
    assert normalize_supported_language("ko-KR") == "ko"


def test_accept_language_uses_quality_order_and_ignores_unsupported_values() -> None:
    assert language_candidates(None, "es;q=1, fr-FR;q=0.9, en;q=0.8", "de") == ("fr", "de", "ko")


def test_json_language_precedes_header_and_bot_without_duplicates() -> None:
    assert language_candidates("en-US", "fr-FR", "en") == ("en", "ko")


def test_blank_and_unsupported_values_fall_back_to_korean() -> None:
    assert language_candidates("", "es-MX", None) == ("ko",)


def test_channel_message_language_priority_uses_json_then_header_then_bot() -> None:
    bot = SimpleNamespace(data_json={"language": "de"})
    assert _message_language_candidates("fr-FR", "en-US", bot) == ("fr", "de", "ko")
    assert _message_language_candidates(None, "en-US", bot) == ("en", "de", "ko")
    assert _message_language_candidates(None, None, bot) == ("de", "ko")


def test_channel_payloads_remain_backward_compatible() -> None:
    assert ChannelRoomCreateRequest(bot_id="bot-id").language is None
    assert ChannelMessageRequest(message="hello").language is None


def test_explicit_korean_header_overrides_stored_room_language() -> None:
    bot = SimpleNamespace(data_json={"language": "de"})
    room = SimpleNamespace(metadata_json={"language": "fr"})
    assert _message_language_candidates(None, "ko-KR", bot, room) == ("ko", "de")
