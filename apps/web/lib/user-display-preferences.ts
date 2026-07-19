export type DialogOptionDisplayMode = "text" | "icon";

const DIALOG_OPTION_DISPLAY_MODE_KEY = "aidot.dialog_option_display_mode";
const DEFAULT_DIALOG_OPTION_DISPLAY_MODE: DialogOptionDisplayMode = "text";

export function normalizeDialogOptionDisplayMode(value?: string | null): DialogOptionDisplayMode {
  return value === "icon" ? "icon" : DEFAULT_DIALOG_OPTION_DISPLAY_MODE;
}

export function loadDialogOptionDisplayMode(): DialogOptionDisplayMode {
  if (typeof window === "undefined") {
    return DEFAULT_DIALOG_OPTION_DISPLAY_MODE;
  }
  return normalizeDialogOptionDisplayMode(window.localStorage.getItem(DIALOG_OPTION_DISPLAY_MODE_KEY));
}

export function saveDialogOptionDisplayMode(mode: DialogOptionDisplayMode) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(DIALOG_OPTION_DISPLAY_MODE_KEY, mode);
  window.dispatchEvent(new CustomEvent("aidot:dialog-option-display-mode", { detail: { mode } }));
}
