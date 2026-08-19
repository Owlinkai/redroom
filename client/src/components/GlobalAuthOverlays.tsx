/**
 * GlobalAuthOverlays — Renders the AdminRequired overlay globally.
 * The AuthModal (Create Account / Sign in) has been intentionally removed.
 * Access to the platform is by invitation only — users must join the waiting list
 * via the Disclaimer → Contribute tab or the lock overlay on protected features.
 */

import { useAuthContext } from "@/contexts/AuthContext";
import { AdminRequired } from "./AdminRequired";

export function GlobalAuthOverlays() {
  const {
    adminRequiredOpen,
    hideAdminRequired,
  } = useAuthContext();

  return (
    <>
      <AdminRequired
        isOpen={adminRequiredOpen}
        onClose={hideAdminRequired}
        onLogin={() => {/* no-op: direct login is disabled */}}
        featureName="Platform Administration"
      />
    </>
  );
}
