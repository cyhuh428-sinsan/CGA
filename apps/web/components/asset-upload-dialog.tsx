"use client";

import { type ReactNode, useRef, useState } from "react";

type AssetUploadDialogProps = {
  title?: string;
  description: ReactNode;
  notice: ReactNode;
  exampleTitle?: string;
  exampleLines?: string[];
  accept: string;
  templateFileName?: string;
  onDownloadTemplate?: () => void;
  onClose: () => void;
  onConfirm: (file: File) => void | Promise<void>;
};

export function AssetUploadDialog({
  title = "파일 업로드",
  description,
  notice,
  exampleTitle,
  exampleLines,
  accept,
  templateFileName,
  onDownloadTemplate,
  onClose,
  onConfirm,
}: AssetUploadDialogProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    if (!selectedFile || submitting) {
      return;
    }

    setSubmitting(true);

    try {
      await onConfirm(selectedFile);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="entity-editor-backdrop" role="presentation">
      <div className="asset-upload-dialog" role="dialog" aria-modal="true" aria-label={title}>
        <div className="entity-editor-dialog__header">
          <strong>{title}</strong>
          <button type="button" className="entity-editor-dialog__close" aria-label="닫기" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="entity-editor-dialog__body asset-upload-dialog__body">
          <div className="asset-upload-dialog__description">{description}</div>

          {onDownloadTemplate ? (
            <div className="asset-upload-dialog__template">
              <button type="button" className="secondary-action asset-upload-dialog__template-button" onClick={onDownloadTemplate}>
                양식 다운로드
              </button>
              {templateFileName ? <small>{templateFileName}</small> : null}
            </div>
          ) : null}

          <div className="asset-upload-dialog__notice">
            <strong>유의사항</strong>
            <div className="asset-upload-dialog__notice-content">
              {notice}
              {exampleLines?.length ? (
                <>
                  <p className="asset-upload-dialog__example-title">{exampleTitle ?? "예시"}</p>
                  <div className="asset-upload-dialog__example" role="presentation">
                    {exampleLines.map((line, index) => (
                      <span key={`${line}-${index}`} className="asset-upload-dialog__example-line">
                        {line}
                      </span>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          </div>

          <div className="asset-upload-dialog__field">
            <span>
              파일 업로드<em>*</em>
            </span>
            <div className="asset-upload-dialog__file-row">
              <input
                className="asset-upload-dialog__file-name"
                type="text"
                value={selectedFile?.name ?? ""}
                placeholder="파일을 선택하세요"
                readOnly
              />
              <button type="button" className="secondary-action" onClick={() => fileInputRef.current?.click()}>
                파일 선택
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept={accept}
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setSelectedFile(file);
                event.target.value = "";
              }}
            />
          </div>
        </div>

        <div className="entity-editor-dialog__footer">
          <button type="button" className="secondary-action" onClick={onClose} disabled={submitting}>
            취소
          </button>
          <button
            type="button"
            className="primary-action"
            onClick={() => void handleConfirm()}
            disabled={!selectedFile || submitting}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
