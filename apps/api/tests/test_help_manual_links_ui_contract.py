from __future__ import annotations

from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[3]


def _read(relative_path: str) -> str:
    return (ROOT_DIR / relative_path).read_text(encoding="utf-8")


def test_help_menu_opens_deployed_manual_pdfs() -> None:
    rail_source = _read("apps/web/components/studio-rail.tsx")

    assert 'href="/manuals/cga-user-manual.pdf"' in rail_source
    assert 'href="/manuals/cga-nlu-guide.pdf"' in rail_source
    assert rail_source.count('target="_blank"') >= 2
    assert rail_source.count('rel="noreferrer"') >= 2


def test_help_manual_pdf_assets_are_packaged() -> None:
    for relative_path in (
        "apps/web/public/manuals/cga-user-manual.pdf",
        "apps/web/public/manuals/cga-nlu-guide.pdf",
    ):
        pdf_path = ROOT_DIR / relative_path
        assert pdf_path.is_file()
        assert pdf_path.read_bytes().startswith(b"%PDF-")
