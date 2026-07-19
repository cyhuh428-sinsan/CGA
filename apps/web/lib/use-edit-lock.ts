"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  acquireEditLock,
  heartbeatEditLock,
  releaseEditLock,
  type EditLockArea,
  type EditLockInfo,
} from "@/lib/studio-bots-api";

type UseEditLockOptions = {
  token?: string | null;
  botId?: string | null;
  versionId?: string | null;
  dialogId?: string | null;
  area: EditLockArea;
  enabled?: boolean;
  onCancel?: () => void;
};

function ownerLabel(lock?: EditLockInfo | null) {
  return lock?.owner.name || lock?.owner.login_id || "다른 사용자";
}

export function useEditLock({
  token,
  botId,
  versionId,
  dialogId,
  area,
  enabled = true,
  onCancel,
}: UseEditLockOptions) {
  const [lockId, setLockId] = useState("");
  const [owner, setOwner] = useState("");
  const [conflictOwner, setConflictOwner] = useState("");
  const [viewOnly, setViewOnly] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  const targetKey = useMemo(
    () => [token, botId, versionId, dialogId, area, enabled ? "1" : "0"].join(":"),
    [area, botId, dialogId, enabled, token, versionId],
  );

  useEffect(() => {
    if (!enabled || !token || !botId || !versionId || !dialogId) {
      setLockId("");
      setOwner("");
      setConflictOwner("");
      setViewOnly(false);
      setMessage("");
      return;
    }

    let ignore = false;
    let acquiredLockId = "";
    setPending(true);
    setMessage("");

    acquireEditLock(token, {
      bot_id: botId,
      version_id: versionId,
      dialog_id: dialogId,
      area,
    })
      .then((response) => {
        if (ignore) {
          return;
        }
        if (response.status === "locked_by_other") {
          const nextOwner = ownerLabel(response.lock);
          setOwner(nextOwner);
          setConflictOwner(nextOwner);
          setViewOnly(false);
          setMessage("");
          setLockId("");
          return;
        }
        const nextLockId = response.lock?.lock_id ?? "";
        acquiredLockId = nextLockId;
        setLockId(nextLockId);
        setOwner("");
        setConflictOwner("");
        setViewOnly(false);
        setMessage("");
      })
      .catch((error) => {
        if (!ignore) {
          setMessage(error instanceof Error ? error.message : "편집 잠금을 확인하지 못했습니다.");
        }
      })
      .finally(() => {
        if (!ignore) {
          setPending(false);
        }
      });

    return () => {
      ignore = true;
      if (acquiredLockId) {
        void releaseEditLock(token, acquiredLockId).catch(() => undefined);
      }
    };
  }, [area, botId, dialogId, enabled, onCancel, targetKey, token, versionId]);

  const acceptViewOnly = useCallback(() => {
    if (!conflictOwner) {
      return;
    }
    setOwner(conflictOwner);
    setConflictOwner("");
    setViewOnly(true);
    setMessage(`${conflictOwner}님이 편집 중입니다. 현재 화면은 조회 모드입니다.`);
  }, [conflictOwner]);

  const cancelViewOnly = useCallback(() => {
    setOwner("");
    setConflictOwner("");
    setViewOnly(false);
    setMessage("");
    onCancel?.();
  }, [onCancel]);

  useEffect(() => {
    if (!token || !lockId || viewOnly) {
      return;
    }

    const timer = window.setInterval(() => {
      void heartbeatEditLock(token, lockId).catch(() => {
        setMessage("편집 잠금 갱신에 실패했습니다. 저장 전 화면을 새로 확인해주세요.");
      });
    }, 30_000);

    return () => {
      window.clearInterval(timer);
    };
  }, [lockId, token, viewOnly]);

  return {
    lockId,
    owner,
    conflictOwner,
    viewOnly,
    message,
    pending,
    acceptViewOnly,
    cancelViewOnly,
  };
}
