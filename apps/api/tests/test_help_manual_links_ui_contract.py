from __future__ import annotations

from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[3]
SUPPORTED_LANGUAGES = ("ko", "en", "zh-CN", "ja", "vi", "fr", "de")


def _read(relative_path: str) -> str:
    return (ROOT_DIR / relative_path).read_text(encoding="utf-8")


def test_help_menu_opens_language_specific_manual_pdfs() -> None:
    rail_source = _read("apps/web/components/studio-rail.tsx")

    assert 'const manualHref = (manual: "getting-started" | "user-manual" | "nlu-guide") =>' in rail_source
    assert "/manuals/cga-" in rail_source
    assert "language}.pdf" in rail_source
    assert 'manualHref("getting-started")' in rail_source
    assert 'manualHref("user-manual")' in rail_source
    assert 'manualHref("nlu-guide")' in rail_source
    assert rail_source.count('target="_blank"') >= 3
    assert rail_source.count('rel="noreferrer"') >= 3


def test_help_manual_pdf_assets_are_packaged_for_all_languages() -> None:
    for language in SUPPORTED_LANGUAGES:
        for manual in ("getting-started", "user-manual", "nlu-guide"):
            pdf_path = ROOT_DIR / f"apps/web/public/manuals/cga-{manual}-{language}.pdf"
            assert pdf_path.is_file(), pdf_path
            assert pdf_path.read_bytes().startswith(b"%PDF-"), pdf_path

    for legacy_name in (
        "cga-getting-started.pdf",
        "cga-user-manual.pdf",
        "cga-nlu-guide.pdf",
    ):
        pdf_path = ROOT_DIR / "apps/web/public/manuals" / legacy_name
        assert pdf_path.is_file(), pdf_path
        assert pdf_path.read_bytes().startswith(b"%PDF-"), pdf_path