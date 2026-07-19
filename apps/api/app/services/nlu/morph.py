from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class MorphToken:
    text: str
    tag: str
    normalized: str


# Korean analyzers label both content adverbs (e.g. "자세히") and degree
# modifiers (e.g. "너무") as MAG. Degree modifiers do not identify an intent.
NON_DISCRIMINATIVE_ADVERBS = frozenset(
    {
        "너무",
        "매우",
        "아주",
        "정말",
        "가장",
        "꽤",
        "상당히",
        "굉장히",
        "조금",
        "좀",
        "더",
        "덜",
        "거의",
        "별로",
        "잘",
        "많이",
    }
)

class MorphAnalyzerProvider(Protocol):
    provider_name: str

    def analyze(self, text: str) -> list[MorphToken]:
        ...


class KiwiMorphAnalyzerProvider:
    provider_name = "kiwipiepy"

    def __init__(self) -> None:
        try:
            from kiwipiepy import Kiwi
        except ImportError as exc:
            raise RuntimeError(
                "kiwipiepy가 설치되어 있지 않습니다. apps/api/requirements.txt 설치 후 다시 학습하세요."
            ) from exc

        self._kiwi = Kiwi()

    def analyze(self, text: str) -> list[MorphToken]:
        normalized_text = normalize_text(text)
        if not normalized_text:
            return []

        tokens: list[MorphToken] = []
        for token in self._kiwi.tokenize(normalized_text):
            form = str(getattr(token, "form", "") or "").strip()
            tag = str(getattr(token, "tag", "") or "").strip()
            lemma = str(getattr(token, "lemma", "") or getattr(token, "base_form", "") or form).strip()
            normalized = normalize_token(lemma)
            if normalized:
                tokens.append(MorphToken(text=form, tag=tag, normalized=normalized))
        return tokens


def normalize_text(value: object) -> str:
    return str(value or "").strip().lower()


def normalize_token(value: object) -> str:
    return re.sub(r"\s+", "", str(value or "").strip().lower())


def select_learning_tokens(tokens: list[MorphToken], include_semantic_adverbs: bool = True) -> list[str]:
    selected: list[str] = []
    for token in tokens:
        tag_base = token.tag.split("-", 1)[0]
        if (
            token.tag.startswith(("N", "SL", "SN"))
            or tag_base in {"VV", "VA", "VCN", "XR"}
            or (include_semantic_adverbs and tag_base == "MAG" and token.normalized not in NON_DISCRIMINATIVE_ADVERBS)
        ):
            selected.append(token.normalized)
        elif tag_base == "VX" and token.normalized in {"말다", "않다", "못하다"}:
            selected.append(token.normalized)
        elif tag_base == "IC" and len(token.normalized) >= 2:
            selected.append(token.normalized)
    return selected


def char_ngrams(text: str, size: int) -> list[str]:
    compact = re.sub(r"[^\w가-힣]+", "", normalize_text(text))
    if not compact:
        return []
    if len(compact) <= size:
        return [compact]
    return [compact[index : index + size] for index in range(0, len(compact) - size + 1)]
