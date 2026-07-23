from __future__ import annotations

SUPPORTED_LANGUAGE_CODES = ("ko", "en", "zh-CN", "ja", "vi", "fr", "de")

_LANGUAGE_ALIASES = {
    "ko": "ko",
    "en": "en",
    "zh": "zh-CN",
    "zh-cn": "zh-CN",
    "ja": "ja",
    "vi": "vi",
    "fr": "fr",
    "de": "de",
}


def normalize_supported_language(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = value.strip().replace("_", "-").lower()
    if not normalized:
        return None
    if normalized in _LANGUAGE_ALIASES:
        return _LANGUAGE_ALIASES[normalized]
    return _LANGUAGE_ALIASES.get(normalized.split("-", 1)[0])


def _accept_language_candidates(value: object) -> tuple[str, ...]:
    if not isinstance(value, str):
        return ()
    weighted: list[tuple[float, int, str]] = []
    for index, item in enumerate(value.split(",")):
        language_range, *parameters = item.strip().split(";")
        quality = 1.0
        for parameter in parameters:
            key, separator, raw_value = parameter.strip().partition("=")
            if separator and key.lower() == "q":
                try:
                    quality = float(raw_value)
                except ValueError:
                    quality = 0.0
        normalized = normalize_supported_language(language_range)
        if normalized is not None and quality > 0:
            weighted.append((-quality, index, normalized))
    ordered = tuple(item[2] for item in sorted(weighted))
    return ordered[:1]


def language_candidates(
    request_language: object,
    accept_language: object,
    bot_language: object,
) -> tuple[str, ...]:
    request_candidate = normalize_supported_language(request_language)
    primary_candidates = (request_candidate,) if request_candidate else _accept_language_candidates(accept_language)
    candidates = (*primary_candidates, normalize_supported_language(bot_language), "ko")
    return tuple(dict.fromkeys(candidate for candidate in candidates if candidate is not None))
