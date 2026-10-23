# TreeNotes - DevOps Guide

A reference for running, maintaining, and handing over the TreeNotes platform. This
covers the infrastructure side: CI/CD, branch protection, environment setup, and how
to run the stack locally.

For day-to-day contribution rules (branch model, avoiding merge conflicts, what not to
commit), see **GIT_WORKFLOW.md** - this guide does not repeat that material.

---

## 1. Repository overview

TreeNotes runs as a set of Docker containers orchestrated by `docker-compose.yml`:

- **frontend** - React/Vite app served by nginx (AI requests may take up to 300s;
  see `proxy_read_timeout` in `nginx.conf`).
- **backend** - FastAPI (Python).
- **db** - PostgreSQL.
- **ollama** - local LLM runtime for the AI features.
- **pgadmin** - database admin UI.

nginx (in the frontend container) reverse-proxies `/api` calls to the backend, so the
frontend talks to the backend through relative `/api/...` paths rather than a hardcoded
URL. That routing config lives in `nginx.conf`.

### Branches

- **main** - stable, demo-ready code only.
- **dev** - shared integration branch; all feature work merges here first.
- Feature branches - `frontend`, `dev-backend`, `ai-dev`, `database-devops`,
  `test-and-integrate`.

See GIT_WORKFLOW.md for the full flow.

---

## 2. Branch protection (GitHub rulesets)

**Important:** these rules live in the repository's GitHub settings, not in the code.
They do **not** travel automatically if the repo is copied. If the repo is transferred
(see section 6) or recreated, verify these are still in place - and if not, recreate
them from this section.

Two rulesets exist, one per protected branch: **Protect dev branch** and
**Protect main branch**. Both enforce the same rules:

- **Require a pull request before merging** (1 approving review).
- **Require status checks to pass** - the `Docker build check` (from the build
  workflow) must be green before merge.
- **Require branches to be up to date before merging.**
- **Block force pushes.**
- **Restrict deletions.**

To edit: GitHub repo → Settings → Rulesets → select the ruleset → Edit.

Note: the smoke-test check (section 3) currently runs but is **not** a required check.
To make it required, add it under "Require status checks to pass" in each ruleset the
same way the build check was added.

---

## 3. CI/CD (GitHub Actions)

Two workflows live in `.github/workflows/`. Both trigger on pull requests into `dev`
and `main`.

### `ci.yml` - Docker build check
Checks out the code and runs `docker compose build`. Green means all images build.
Fast (~30s). This is a **required** check for merging.

### `smoke-test.yml` - Stack smoke test
Goes further than the build check: it actually starts the stack and confirms the
backend responds. Steps:

1. Creates a `.env` from `.env.example`, overriding the model to a small one
   (`qwen2.5:0.5b`) so CI isn't downloading gigabytes.
2. Starts the Ollama container and pulls the small model.
3. Brings up the full stack.
4. Polls the backend `/health` endpoint until it returns HTTP 200 (with a timeout).
5. Dumps container logs if it fails, then tears everything down.

Takes ~1 minute. This catches startup failures the build check can't (e.g. a missing
or malformed `.env`). It currently runs but is **not** a required check - leave it
non-blocking until it's proven stable over several PRs, then make it required if
desired (see section 2).

---

## 4. Running the stack locally

Requirements: Docker Desktop. The full walkthrough (URLs, credentials, pgAdmin, GPU
options) is in the **Running the Stack Locally** section of `README.md`; the short
version is:

```
cp .env.example .env
docker compose up -d ollama
docker exec -it ollama ollama pull qwen2.5-coder:latest
docker compose up -d --build
docker compose run --rm backend alembic -c backend/alembic.ini upgrade head
```

The model pull mirrors what `smoke-test.yml` does (with a smaller model). Without it
the stack starts, but the AI panels return `502`.

Once running:

- Frontend: http://localhost:8080
- Backend API docs: http://localhost:8000/docs
- Backend health check: http://localhost:8000/health (through nginx: http://localhost:8080/api/health)
- pgAdmin: http://localhost:5050 (localhost only)
- Ollama: http://localhost:11434

Database migrations are run manually, as above. Verify with:

```
docker compose run --rm backend alembic -c backend/alembic.ini current
```

`-c backend/alembic.ini` is required: `docker compose run` starts in `/app`, but
`alembic.ini` lives in `/app/backend`.

### Troubleshooting: port 5432 already in use

If `docker compose up` fails to bind port 5432, a local PostgreSQL service on your
machine is already using it. Stop it (Windows, run as Administrator; the version
number may differ):

```
Stop-Service postgresql-x64-18
```

Then bring the stack up again.

---

## 5. Environment and secrets

- Real configuration lives in `.env`, which is **gitignored** and never committed.
- `.env.example` is the committed template. Copy it to `.env` to get started.
- The dev login (`dev@treenotes.local` / `demo1234`) is seeded by a database
  migration - it is not read from `.env`. Those lines in `.env.example` are commented
  out and kept only as a reference note.

### Ports (from `docker-compose.yml`)

| Service   | Host port        | Notes                              |
|-----------|------------------|------------------------------------|
| frontend  | 8080             | nginx serving the built app        |
| backend   | 8000             | FastAPI                            |
| db        | 127.0.0.1:5432   | localhost only                     |
| pgadmin   | 127.0.0.1:5050   | localhost only                     |
| ollama    | 11434            | LLM runtime                        |

---

## 6. Handover / repo transfer

**Read this before the current owner leaves.**

The repository currently lives on a personal GitHub account and is the shared origin
that every team member's remote points to. If that account goes away without a
transfer, the team loses their shared origin.

### Recommended: transfer ownership (not copy)

GitHub's **Transfer ownership** (Settings → General → Danger Zone → Transfer) moves the
repo - with all branches, history, issues, pull requests, **and settings such as the
rulesets** - to another account, and leaves a redirect so existing clones keep working.
A plain copy/mirror does **not** carry the rulesets, PRs, or issues, and breaks
everyone's remotes with no redirect, so prefer transfer.

Notes and caveats:

- The destination should ideally be a **shared or organisation account**, not another
  individual's personal account, so the platform isn't tied to one person again.
- This repo is itself a fork; transferring forks can occasionally be fiddly on GitHub.
  Test/plan the transfer early rather than the day someone leaves.
- After transfer, **every team member must re-point their remote**:
  ```
  git remote set-url origin <new-repo-url>
  ```
- After transfer, confirm the rulesets (section 2) and workflows (section 3) are
  intact on the new location; recreate the rulesets from section 2 if they didn't
  carry over.

### Handover checklist

1. Choose the new home (shared/org account preferred).
2. Transfer the repository there.
3. Verify rulesets and CI workflows are present; recreate rulesets if needed.
4. Have every member re-point their `origin` remote.
5. Only then delete/abandon the old location, if at all.
