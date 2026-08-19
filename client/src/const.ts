export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/**
 * getLoginUrl is no longer used for external OAuth.
 * Auth is handled by the in-app AuthModal component.
 * This function returns a no-op path for backward compatibility.
 */
export const getLoginUrl = () => "/login";
