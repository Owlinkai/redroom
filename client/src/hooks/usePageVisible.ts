import { useEffect, useState } from "react";

/**
 * usePageVisible — returns true when the browser tab/window is visible.
 * Uses the Page Visibility API (document.visibilityState).
 * Animations and intervals should be paused when this returns false.
 */
export function usePageVisible(): boolean {
  const [visible, setVisible] = useState<boolean>(
    typeof document !== "undefined" ? document.visibilityState === "visible" : true
  );

  useEffect(() => {
    const handler = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  return visible;
}
