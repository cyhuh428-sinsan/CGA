"use client";

import { useEffect, useState } from "react";

export const DIALOG_PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100] as const;
export const LIST_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export type DialogPageSize = (typeof DIALOG_PAGE_SIZE_OPTIONS)[number];
export type ListPageSize = (typeof LIST_PAGE_SIZE_OPTIONS)[number];

export function usePersistedPageSize<T extends number>(
  storageKey: string,
  defaultValue: T,
  allowedValues: readonly T[],
) {
  const [pageSize, setPageSize] = useState<T>(defaultValue);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      setLoaded(true);
      return;
    }

    const savedValue = window.localStorage.getItem(storageKey);
    if (!savedValue) {
      setLoaded(true);
      return;
    }

    const parsedValue = Number(savedValue) as T;
    if (allowedValues.includes(parsedValue)) {
      setPageSize(parsedValue);
    }
    setLoaded(true);
  }, [allowedValues, storageKey]);

  useEffect(() => {
    if (!loaded) {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(storageKey, String(pageSize));
  }, [loaded, pageSize, storageKey]);

  return [pageSize, setPageSize] as const;
}
