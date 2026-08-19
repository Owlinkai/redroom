# Contributing to Redroom V2.4

Thank you for your interest in contributing to Redroom V2.4. This document explains how to get involved, what we expect from contributors, and how the review process works.

---

## Code of Conduct

All contributors are expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md). Please read it before participating.

---

## Ways to Contribute

Contributions are welcome in several forms:

- **Bug reports** — open a GitHub Issue with a clear description, steps to reproduce, and expected vs. actual behaviour.
- **Feature requests** — open a GitHub Issue describing the use case, the proposed solution, and any alternatives you considered.
- **Code contributions** — fork the repository, make your changes on a feature branch, and open a Pull Request.
- **Documentation improvements** — corrections, clarifications, and additions to any `.md` file are always appreciated.
- **OSINT community feedback** — if you are an analyst or researcher using the platform, your domain expertise is invaluable for shaping the roadmap.

---

## Development Setup

Follow the [Quick Start](README.md#quick-start) section in the README to get a local development environment running. The key commands are:

```bash
pnpm install        # Install all dependencies
pnpm db:push        # Apply database schema migrations
pnpm dev            # Start the development server (http://localhost:3000)
pnpm test           # Run the Vitest test suite
pnpm build          # Build for production
```

---

## Branch Strategy

| Branch | Purpose |
|---|---|
| `main` | Stable, production-ready code |
| `feature/<name>` | New features |
| `fix/<name>` | Bug fixes |
| `docs/<name>` | Documentation-only changes |

All pull requests should target `main`. Do not push directly to `main`.

---

## Pull Request Guidelines

Before opening a Pull Request, please ensure:

1. **Your branch is up to date** with `main` (`git pull origin main`).
2. **Tests pass** — run `pnpm test` and ensure all tests pass. If you are adding a new feature, add corresponding Vitest tests in `server/*.test.ts`.
3. **TypeScript compiles cleanly** — run `pnpm tsc --noEmit` and resolve any type errors.
4. **No secrets are committed** — double-check that `.env` files, API keys, and private URLs are not included in your diff. The `.gitignore` should catch most cases, but always verify.
5. **The schema is migrated** — if you changed `drizzle/schema.ts`, run `pnpm db:push` and include the generated migration files in your commit.
6. **The PR description explains the change** — describe what changed, why, and how to test it.

---

## Commit Message Convention

Use the [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <short summary>

[optional body]
[optional footer]
```

| Type | When to use |
|---|---|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation changes only |
| `style` | Formatting, whitespace (no logic change) |
| `refactor` | Code restructuring without behaviour change |
| `test` | Adding or updating tests |
| `chore` | Build system, dependency updates, tooling |

Examples:

```
feat(crawler): add retry logic with exponential backoff
fix(cms): resolve mission run log pagination off-by-one
docs(architecture): add data flow diagram for crawler pipeline
```

---

## What We Will Not Accept

- Code that introduces new dependencies without prior discussion in an Issue.
- Changes that remove or weaken the dual-authentication model (see [ARCHITECTURE.md](ARCHITECTURE.md#authentication--access-control)).
- Hardcoded secrets, API keys, private URLs, or database credentials of any kind.
- Code that stores or transmits personally identifiable information without explicit consent mechanisms.
- Changes that break the existing Vitest test suite without a clear justification.

---

## Reporting Bugs

When filing a bug report, please include:

- The version or commit hash you are running.
- Your Node.js version (`node --version`) and OS.
- A minimal reproduction case — the fewer steps to reproduce, the better.
- The full error message and stack trace if applicable.
- What you expected to happen and what actually happened.

---

## Security Issues

**Do not open public GitHub Issues for security vulnerabilities.** Please follow the responsible disclosure process described in [SECURITY.md](SECURITY.md).

---

*Redroom V2.4 is an initiative of [Owlink.ai](https://owlink.ai) — Stealth Intelligence for Gov and People · Built by Alexsai · © 2024–2026 Alexsai · Owlink.ai*
