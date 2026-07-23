from types import SimpleNamespace
from uuid import uuid4

from app.services.default_message_catalog import DEFAULT_MESSAGE_CATALOGS
from app.services.default_messages import get_default_message_text


def test_every_default_message_key_exists_in_all_supported_languages() -> None:
    korean_keys = set(DEFAULT_MESSAGE_CATALOGS["ko"])
    assert len(korean_keys) == 14
    assert set(DEFAULT_MESSAGE_CATALOGS) == {"ko", "en", "zh-CN", "ja", "vi", "fr", "de"}
    for messages in DEFAULT_MESSAGE_CATALOGS.values():
        assert set(messages) == korean_keys


class _SequentialSession:
    def __init__(self, values: list[object]) -> None:
        self.values = iter(values)
        self.calls = 0

    def scalar(self, _statement: object) -> object:
        self.calls += 1
        return next(self.values)


def test_message_lookup_follows_language_chain() -> None:
    session = _SequentialSession([None, SimpleNamespace(message_text="Erreur personnalisée")])

    result = get_default_message_text(
        session,  # type: ignore[arg-type]
        uuid4(),
        "system_error",
        languages=("de", "fr", "ko"),
    )

    assert result == "Erreur personnalisée"
    assert session.calls == 2


def test_message_lookup_uses_korean_code_fallback_when_database_has_no_active_row() -> None:
    session = _SequentialSession([None, None])

    result = get_default_message_text(
        session,  # type: ignore[arg-type]
        uuid4(),
        "session_end",
        languages=("fr", "ko"),
    )

    assert result == DEFAULT_MESSAGE_CATALOGS["ko"]["session_end"]["message_text"]
