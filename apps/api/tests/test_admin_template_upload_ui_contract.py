from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[3]


def test_template_csv_upload_continues_after_row_failure_and_reloads() -> None:
    source = (ROOT_DIR / "apps/web/app/admin/templates/page.tsx").read_text(encoding="utf-8")
    catalog = (ROOT_DIR / "apps/web/lib/i18n/admin-templates.ts").read_text(encoding="utf-8")
    upload_start = source.index("async function handleUpload")

    assert "const failedRows: string[] = [];" in source
    assert "for (const [rowIndex, row] of dataRows.entries())" in source
    assert "failedRows.push" in source
    assert "formatAdminTemplateText(copy.uploadSummary" in source
    assert "uploadSummary:string" in catalog
    assert source.index("await reload();", upload_start) < source.index(
        "setNoticeMessage(summary)", upload_start
    )


def test_template_create_uses_only_active_registered_channel_options() -> None:
    source = (ROOT_DIR / "apps/web/app/admin/templates/page.tsx").read_text(encoding="utf-8")
    channel_field_start = source.index("<span>{copy.channel}</span>")
    channel_field_end = source.index("{isKakaoTemplateChannel", channel_field_start)
    channel_field = source[channel_field_start:channel_field_end]

    assert "fetchChannels," in source
    assert 'fetchChannels(token, { status: "active" })' in source
    assert "const [activeChannels, setActiveChannels]" in source
    assert 'channel_code: activeChannels[0]?.code ?? ""' in source
    assert "<select" in channel_field
    assert "activeChannels.map((channel)" in channel_field
    assert "{copy.noChannel}" in channel_field