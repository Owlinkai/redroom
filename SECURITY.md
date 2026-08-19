# Security Policy

## Supported Versions

Security fixes are applied to the latest version on the `main` branch. We do not backport security patches to older releases.

| Version | Supported |
|---|---|
| Redroom V2.4 (`main`) | ✅ |
| Older commits | ❌ |

---

## Reporting a Vulnerability

**Please do not open a public GitHub Issue for security vulnerabilities.** Doing so exposes the vulnerability to all users before a fix is available.

Instead, report security issues by emailing:

**security@owlink.ai**

Please include the following in your report:

- A clear description of the vulnerability and its potential impact.
- The affected component(s) — e.g., authentication, crawler, CMS, database layer.
- Steps to reproduce the issue, including any proof-of-concept code or payloads.
- Your suggested fix or mitigation, if you have one.

We will acknowledge your report within **48 hours** and aim to provide a fix or mitigation within **14 days** for critical issues.

---

## Responsible Disclosure

We follow a coordinated disclosure model:

1. You report the vulnerability privately to `security@owlink.ai`.
2. We confirm receipt and begin investigation within 48 hours.
3. We develop and test a fix.
4. We release the fix and notify you.
5. After the fix is deployed, we publicly acknowledge your contribution (unless you prefer to remain anonymous).

We ask that you do not publicly disclose the vulnerability until we have had a reasonable opportunity to address it.

---

## Security Architecture Notes

The following design decisions are relevant to the security posture of the platform:

**Dual authentication** — The CMS super-admin token (`x-sa-token`) is completely independent of the OAuth user session. Compromising a user account — even an admin account — does not grant CMS access. The `ADMIN_SECRET_KEY` environment variable must be kept secret and rotated if compromised.

**Environment variable isolation** — Variables prefixed with `VITE_` are bundled into the client-side JavaScript and are visible to end users. Private API keys and secrets must never be placed in `VITE_` variables. The `BUILT_IN_FORGE_API_KEY` (LLM service key) is server-side only and is never exposed to the client.

**Session cookies** — Session cookies are `httpOnly` and `sameSite: lax`. They are signed with `JWT_SECRET`. If `JWT_SECRET` is compromised, all active sessions must be considered invalid and the secret must be rotated immediately (which invalidates all existing sessions).

**Database access** — The database is accessed only from the server process via `DATABASE_URL`. The connection string must never be exposed to the client or committed to version control.

**No secrets in git** — The `.gitignore` excludes `.env` files, `server/_core/`, `references/`, and other platform-internal directories. Always verify your diff before committing to ensure no secrets are included.

---

## Known Limitations

- The rate limiter (`server/rateLimiter.ts`) is in-process and resets on server restart. For production deployments with multiple instances, a distributed rate limiter (e.g., Redis-backed) should be used.
- The crawler User-Agent (`RedroomBot/1.0`) identifies the platform to target servers. Operators should be aware that crawled sources can observe and block this User-Agent.

---

*Redroom V2.4 is an initiative of [Owlink.ai](https://owlink.ai) — Stealth Intelligence for Gov and People · Built by Alexsai · © 2024–2026 Alexsai · Owlink.ai*
