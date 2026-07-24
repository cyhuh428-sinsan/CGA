from __future__ import annotations

from app.services.llm_intent import _system_prompt
from app.services.nlu.deep_learning_lite import tokenize_texts_for_deep_learning_lite
from app.services.nlu.morph import KiwiMorphAnalyzerProvider, UnicodeMorphAnalyzerProvider, create_morph_analyzer
from app.api.routes.bots import _compact_semantic_text
from app.api.routes.channels import _semantic_match_key, _tokens


def test_korean_keeps_existing_kiwi_analyzer(monkeypatch) -> None:
    monkeypatch.setattr(KiwiMorphAnalyzerProvider, "__init__", lambda self: None)

    assert isinstance(create_morph_analyzer("ko"), KiwiMorphAnalyzerProvider)


def test_non_korean_languages_use_unicode_analyzer() -> None:
    for language in ("en", "zh-CN", "ja", "vi", "fr", "de"):
        analyzer = create_morph_analyzer(language)
        assert isinstance(analyzer, UnicodeMorphAnalyzerProvider)
        assert analyzer.provider_name == "unicode_generic"


def test_unicode_analyzer_keeps_words_and_cjk_ngrams() -> None:
    analyzer = UnicodeMorphAnalyzerProvider()

    assert [item.normalized for item in analyzer.analyze("Cancel my contract")] == ["cancel", "my", "contract"]
    chinese_tokens = {item.normalized for item in analyzer.analyze("取消合同")}
    assert {"取消", "消合", "合同"}.issubset(chinese_tokens)


def test_non_korean_ml_tokenization_does_not_require_kiwi(monkeypatch) -> None:
    def fail_if_created(self) -> None:
        raise AssertionError("non-Korean ML must not create Kiwi")

    monkeypatch.setattr(KiwiMorphAnalyzerProvider, "__init__", fail_if_created)

    result = tokenize_texts_for_deep_learning_lite(["Cancel my contract"], language="en")

    assert result[0]["tokens"] == ["cancel", "my", "contract"]


def test_llm_prompt_uses_bot_language_without_changing_korean_default() -> None:
    assert "한국어 NLU 의도 분류 엔진" in _system_prompt(3, "ko")
    english_prompt = _system_prompt(3, "en")
    assert "English NLU intent classification engine" in english_prompt
    assert "한국어 NLU 의도 분류 엔진" not in english_prompt


def test_runtime_normalization_keeps_every_supported_script() -> None:
    assert _compact_semantic_text("取消 合同") == "取消合同"
    assert _semantic_match_key("契約 を 解約") == "契約を解約"
    assert _tokens("résilier le contrat") == {"résilier", "le", "contrat"}
