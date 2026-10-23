# TreeNotes — Team Git Workflow

A shared, simple way of working with Git so we stop hitting large merge conflicts and keep the repo clean. Please read it through once, then keep it handy as a reference. If anything is unclear, ask before pushing.

---

## 1. The branch model

- **main** — stable, demo-ready code only. Nobody commits to it directly.
- **dev** — the shared integration branch. All feature work comes together here.
- **Feature branches** (`frontend`, `dev-backend`, `ai-dev`, `database-devops`, `test-and-integrate`) — where day-to-day work happens.

The flow: work on your feature branch, open a pull request into `dev`, and once `dev` is stable it gets merged into `main`.

---

## 2. Five rules that prevent most conflicts

1. **Never commit directly to `main` or `dev`.** Always work on your own feature branch.
2. **Sync with `dev` often** — at least once a day. Small, frequent merges are easy. Big, rare ones are what caused our current conflict.
3. **Keep changes small.** Open pull requests frequently instead of letting a branch drift for weeks.
4. **Never commit generated files or secrets** — no `__pycache__`, `.pyc`, `node_modules`, build output, or `.env`. See section 5.
5. **Always pull before you push.**

---

## 3. Daily workflow (commits and pushes)

**Start of day — get up to date before you write any code:**

```powershell
git checkout <your-branch>
git pull                 # update your own branch
git merge origin/dev     # bring in the latest integrated work from dev
```

Doing this daily means you resolve a little bit of overlap at a time, instead of a month's worth all at once.

**While you work — commit in small, logical chunks:**

```powershell
git status               # check what you're about to stage
git add <files you changed>
git commit -m "Short description of what changed"
```

Commit messages: short, present tense, say what the change does — e.g. `Add note-delete endpoint`, `Fix login redirect`. Avoid `git add .` unless you've just run `git status` and know exactly what's being added — that's how junk files slip in.

**Before you push:**

```powershell
git pull
git push
```

---

## 4. Pull requests

- Open a PR from your feature branch **into `dev`** (base: `dev`, compare: `your-branch`).
- Keep each PR **small** — ideally one feature or fix, not weeks of accumulated work.
- **Resolve conflicts locally, not in the browser.** If GitHub says the PR has conflicts:

  ```powershell
  git checkout <your-branch>
  git merge origin/dev
  # fix any conflicts (see section 6), then:
  git push
  ```

  The PR updates automatically and should then merge cleanly.
- Where possible, **one teammate reviews** before the PR is merged.

---

## 5. .gitignore and clearing tracked junk

This is the fix for the `.pyc` / `__pycache__` conflicts we hit. It has two parts, and it's important to know which is which:

- **An ongoing rule everyone follows** — the `.gitignore` file and "don't commit generated files." This is permanent.
- **A one-time cleanup, done by DevOps only** — untracking the junk that was already committed. This happened once and must **not** be repeated by anyone else.

### Ongoing rule (everyone): the `.gitignore`

Put this `.gitignore` at the repo root. It tells Git which files to never track from now on, so build artifacts and secrets stay out of the repo:

```gitignore
# Python / FastAPI
__pycache__/
*.py[cod]
.venv/
venv/
env/
.pytest_cache/

# Environment / secrets
.env
.env.*
!.env.example

# Node / React / Vite (frontend)
node_modules/
dist/
build/
.vite/

# Docker (keep the tracked compose files; ignore local overrides)
docker-compose.override.yml

# IDE / OS
.vscode/
.idea/
.DS_Store
Thumbs.db

# Logs
*.log
```

(The `!.env.example` line keeps our example env file tracked while ignoring real `.env` files that contain secrets.)

### One-time cleanup (DevOps only — already done)

> **You do not need to run this.** It was performed once by DevOps on `dev` on **[fill in date]** to untrack the build artifacts that had already been committed. It is recorded in the commit history and must not be repeated — running it again on another branch just creates duplicate cleanup commits. It's documented here only so everyone understands what happened.

For reference, the one-time command was:

```powershell
git rm -r --cached .
git add .
git commit -m "Stop tracking build artifacts and apply .gitignore"
```

`git rm -r --cached .` removed everything from Git's tracking (but **not** from anyone's disk), and `git add .` re-added only the files that aren't ignored — so the net effect was just the junk files getting untracked.

**What this means for you now:** once you've pulled `dev` (and merged it into your branch), the cleanup is already in your working copy. From then on, if `git status` ever shows `__pycache__` or `.env` as new files, something is wrong — flag it before committing.

---

## 6. How to resolve a merge conflict

When Git says `CONFLICT` / `Automatic merge failed`:

1. Run `git status` to see which files conflict.
2. Open each conflicted file. You'll see markers like:

   ```
   <<<<<<< HEAD
   your branch's version
   =======
   the incoming version
   >>>>>>> origin/dev
   ```

3. Edit the file so it contains the correct final version, and **delete the three marker lines** (`<<<<<<<`, `=======`, `>>>>>>>`).
4. Stage each fixed file: `git add <file>`.
5. When all files are resolved: `git commit` to finish the merge.

If it's a big or scary one, `git merge --abort` cancels the whole thing and puts you back exactly where you started — then ask for help before retrying.
