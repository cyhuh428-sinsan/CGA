"use client";

export type UploadResultRow = {
  label: string;
  value: number;
};

export type UploadResultSection = {
  rows: UploadResultRow[];
};

type UploadResultDialogProps = {
  title?: string;
  message: string;
  note?: string;
  sections: UploadResultSection[];
  onClose: () => void;
};

export function UploadResultDialog({
  title = "업로드 결과",
  message,
  note,
  sections,
  onClose,
}: UploadResultDialogProps) {
  return (
    <div className="entity-editor-backdrop" role="presentation">
      <div className="upload-result-dialog" role="dialog" aria-modal="true" aria-label={title}>
        <div className="entity-editor-dialog__header">
          <strong>{title}</strong>
          <button type="button" className="entity-editor-dialog__close" aria-label="닫기" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="entity-editor-dialog__body">
          <p className="upload-result-dialog__message">{message}</p>
          {note ? <p className="upload-result-dialog__note">{note}</p> : null}

          <div className="upload-result-dialog__panel">
            {sections.map((section, sectionIndex) => (
              <div key={sectionIndex} className="upload-result-dialog__section">
                {section.rows.map((row) => (
                  <div key={row.label} className="upload-result-dialog__row">
                    <span>{row.label}</span>
                    <strong>{row.value}건</strong>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="entity-editor-dialog__footer">
          <button type="button" className="secondary-action upload-result-dialog__close-button" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
