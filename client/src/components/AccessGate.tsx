/**
 * AccessGate — Wraps interactive elements to enforce role-based access.
 *
 * For anonymous users: shows the WaitingListModal (no login/register form).
 * For non-admin users trying admin features: shows admin-required overlay.
 * For authorized users: renders children normally.
 */

import { type ReactNode, useCallback, useState } from "react";
import { useAuthContext } from "@/contexts/AuthContext";
import { WaitingListModal } from "./WaitingListModal";

interface AccessGateProps {
  children: ReactNode;
  /** Minimum role required: 'analyst' (any logged-in user) or 'admin' */
  requires: "analyst" | "admin";
  /** Human-readable feature name shown in the access-denied overlay */
  featureName?: string;
  /** If true, renders children but disables interaction (grayed out) */
  showDisabled?: boolean;
  /** Optional: completely hide the element if not authorized */
  hideIfUnauthorized?: boolean;
}

export function AccessGate({
  children,
  requires,
  featureName: _featureName,
  showDisabled = false,
  hideIfUnauthorized = false,
}: AccessGateProps) {
  const { user, isAdmin, showAdminRequired } = useAuthContext();
  const [waitingListOpen, setWaitingListOpen] = useState(false);

  const isAuthorized = requires === "admin" ? isAdmin : !!user;

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (isAuthorized) return;

      e.preventDefault();
      e.stopPropagation();

      if (!user) {
        // No login form — direct to waiting list
        setWaitingListOpen(true);
      } else if (requires === "admin" && !isAdmin) {
        showAdminRequired();
      }
    },
    [isAuthorized, user, requires, isAdmin, showAdminRequired]
  );

  if (hideIfUnauthorized && !isAuthorized) return null;

  if (showDisabled && !isAuthorized) {
    return (
      <div className="opacity-40 cursor-not-allowed pointer-events-none select-none" title="Authorised users only">
        {children}
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <>
        <div onClick={handleClick} className="cursor-pointer">
          {children}
        </div>
        <WaitingListModal open={waitingListOpen} onClose={() => setWaitingListOpen(false)} />
      </>
    );
  }

  return <>{children}</>;
}
