from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[3]


def test_template_csv_upload_continues_after_row_failure_and_reloads() -> None:
    source = (ROOT_DIR / "apps/web/app/admin/templates/page.tsx").read_text(encoding="utf-8")
    upload_start = source.index("async function handleUpload")

    assert "const failedRows: string[] = [];" in source
    assert "for (const [rowIndex, row] of dataRows.entries())" in source
    assert "failedRows.push" in source
    assert "건 실패" in source
    assert source.index("await reload();", upload_start) < source.index(
        "setNoticeMessage(summary)", upload_start
    )
