"use client";
import { useEffect, useSyncExternalStore } from "react";

function snapshot() {
  let mode = "system";
  try {
    mode = localStorage.getItem("pattern-studio-theme") ?? "system";
  } catch {
    /* Storage may be disabled. */
  }
  if (!["light", "dark", "system"].includes(mode)) mode = "system";
  return `${mode}:${window.matchMedia("(prefers-color-scheme: dark)").matches}`;
}
function subscribe(callback: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  window.addEventListener("storage", callback);
  window.addEventListener("studio-theme", callback);
  media.addEventListener("change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("studio-theme", callback);
    media.removeEventListener("change", callback);
  };
}
export function ThemePicker() {
  const value = useSyncExternalStore(subscribe, snapshot, () => "system:false");
  const [mode, dark] = value.split(":");
  useEffect(() => {
    const resolved =
      mode === "system" ? (dark === "true" ? "dark" : "light") : mode;
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
  }, [mode, dark]);
  return (
    <label className="theme-picker">
      <span>Appearance</span>
      <select
        aria-label="Appearance"
        value={mode}
        onChange={(event) => {
          try {
            localStorage.setItem("pattern-studio-theme", event.target.value);
          } catch {
            /* Keep native system appearance when storage is disabled. */
          }
          window.dispatchEvent(new Event("studio-theme"));
        }}
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}
