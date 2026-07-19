"use client";

import { ChangeEvent, type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AdminInteractiveTablePage } from "@/components/admin-interactive-table-page";
import { applyAdminLicense, fetchAdminLicense, type AdminLicenseStatusResponse } from "@/lib/admin-api";
import { loadAuthSession } from "@/lib/auth";

function displayNumber(value: number | null) {
  return value === null ? "-" : value.toLocaleString("ko-KR");
}

function licenseStatusText(status?: string) {
  if (status === "active") return "사용";
  if (status === "expired") return "만료";
  if (status === "replaced") return "교체됨";
  return status || "-";
}

export default function AdminLicensePage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [licenseStatus, setLicenseStatus] = useState<AdminLicenseStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState("");

  const loadLicense = useCallback(async () => {
    const session = loadAuthSession();
    if (!session) return;
    setLoading(true);
    try {
      const data = await fetchAdminLicense(session.access_token);
      setLicenseStatus(data);
      setMessage(data.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "라이선스 정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLicense();
  }, [loadLicense]);

  async function handleLicenseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const session = loadAuthSession();
    if (!session) return;

    setApplying(true);
    try {
      const licenseText = await file.text();
      const data = await applyAdminLicense(session.access_token, licenseText);
      setLicenseStatus(data);
      setMessage("라이선스가 적용되었습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "라이선스 적용에 실패했습니다.");
    } finally {
      setApplying(false);
    }
  }

  const rows = useMemo(
    () =>
      (licenseStatus?.usage ?? []).map((item) => ({
        key: item.key,
        cells: [
          item.label,
          displayNumber(item.limit),
          displayNumber(item.used),
          displayNumber(item.remaining),
          item.expires_at ?? "-",
        ],
      })),
    [licenseStatus],
  );

  const currentLicense = licenseStatus?.license;
  const toolbarRight = (
    <span className="admin-page__selection">
      {loading ? "불러오는 중입니다..." : message || "-"}
    </span>
  );

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".license,application/json"
        onChange={handleLicenseFile}
        style={{ display: "none" }}
      />
      <AdminInteractiveTablePage
        title="라이선스 조회"
        searchPlaceholder="라이선스 이름을 검색하세요."
        totalText={`전체 ${rows.length}건`}
        columns={["구분", "전체 수", "사용중", "잔여", "만료일"]}
        rows={rows}
        template="minmax(120px, 0.9fr) minmax(120px, 1fr) minmax(120px, 1fr) minmax(120px, 1fr) minmax(140px, 1fr)"
        topRight={
          <button
            type="button"
            className="admin-page__primary"
            disabled={applying}
            onClick={() => fileInputRef.current?.click()}
          >
            {applying ? "적용 중" : "라이선스 업로드"}
          </button>
        }
        toolbarRight={toolbarRight}
        loading={loading}
      />

      <section className="admin-page admin-license-summary" aria-label="라이선스 상세 정보">
        <h2>라이선스 정보</h2>
        <div className="data-grid data-grid--admin" style={{ "--data-grid-template": "1fr 1fr 1fr 1fr" } as CSSProperties}>
          <div className="data-grid__row data-grid__row--header">
            <div className="data-grid__cell">라이선스 ID</div>
            <div className="data-grid__cell">고객</div>
            <div className="data-grid__cell">상태</div>
            <div className="data-grid__cell">발급일</div>
          </div>
          <div className="data-grid__row">
            <div className="data-grid__cell">{currentLicense?.license_id ?? "-"}</div>
            <div className="data-grid__cell">{currentLicense?.customer_name ?? "-"}</div>
            <div className="data-grid__cell">{licenseStatusText(currentLicense?.status)}</div>
            <div className="data-grid__cell">{currentLicense?.issued_at ?? "-"}</div>
          </div>
        </div>
      </section>
    </>
  );
}