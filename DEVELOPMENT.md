# TreeNotes - Development Setup Guide

This guide will get the full TreeNotes development environment running on your machine. You do not need to install Python, PostgreSQL, Ollama, or any other dependencies manually. Everything runs inside Docker.

The condensed version of this guide (steps, URLs, credentials) lives in the **Running the Stack Locally** section of `README.md`.

---

## Prerequisites

The only thing you need to install is **Docker Desktop**:
- Download it here: https://www.docker.com/products/docker-desktop
- Once installed, open Docker Desktop and wait until it says **"Docker Desktop is running"** in the system tray

> **GPU note:** Ollama runs in its own Docker container and uses the CPU by default. NVIDIA GPUs can be passed into that container; AMD and Intel GPUs cannot, so those machines run Ollama natively instead. See [AI / Ollama Setup](#ai--ollama-setup).

---

## Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/KJ793/tree-notes.git
cd tree-notes
```

### 2. Switch to the dev branch
```bash
git checkout dev
```

### 3. Set up your environment variables
```bash
cp .env.example .env              # bash
Copy-Item .env.example .env       # PowerShell
```
You do not need to change anything in `.env` for local development. The default values will work out of the box.

### 4. Start Ollama and pull the AI model
```bash
docker compose up -d ollama
docker exec -it ollama ollama pull qwen2.5-coder:latest
```
This downloads roughly 4.7 GB the first time. See [AI / Ollama Setup](#ai--ollama-setup) for which model the backend uses and how to enable a GPU.

### 5. Start everything
```bash
docker compose up -d --build
```
This will start five services:
| Service | What it is | Where to access it |
|---------|-----------|-------------------|
| Frontend | React (Vite) app served by nginx | http://localhost:8080 |
| Backend | FastAPI (Python) | http://localhost:8000 (API docs: http://localhost:8000/docs) |
| Database | PostgreSQL | `localhost:5432` (not a web page; use pgAdmin or a desktop client) |
| pgAdmin | Database browser UI | http://localhost:5050 |
| Ollama | Local LLM runtime | http://localhost:11434 |

### 6. Set up the database
Run this once after your first `docker compose up`:
```bash
docker compose run --rm backend alembic -c backend/alembic.ini upgrade head
```
This creates all the database tables and seeds the demo user (`dev@treenotes.local` / `demo1234`). You only need to do this once, or any time a new migration is added.

`-c backend/alembic.ini` is required: the backend code lives at `/app/backend` while `docker compose run` starts in `/app`, so `alembic.ini` is not in the working directory.

### 7. Check it works
```bash
curl http://localhost:8000/health        # backend directly
curl http://localhost:8080/api/health    # through the nginx proxy
curl http://localhost:11434              # Ollama
```
In PowerShell, use `curl.exe`. Then open http://localhost:8080 and log in with the demo user.

---

## AI / Ollama Setup

### How the backend picks a model
The backend reads these from `.env` (see `backend/ai/ai.py`):

| Variable | Default | Purpose |
|----------|---------|---------|
| `OLLAMA_URL` | `http://ollama:11434/api/generate` | Where the backend sends prompts |
| `SMALL_MODEL_NAME` | `qwen2.5-coder:latest` | Used by default |
| `LARGE_MODEL_NAME` | `qwen2.5-coder:14b` | Used if an NVIDIA GPU with 12 GB+ VRAM is detected |
| `OLLAMA_MODEL` | unset | If set, always used; skips GPU detection |

At startup the backend runs `nvidia-smi` inside the `ollama` container to measure VRAM. This only works for NVIDIA GPUs; on any other machine the detected VRAM is 0 and the small model is used unless `OLLAMA_MODEL` is set.

Whichever model the backend picks must be pulled, or the AI panels return `502`. Set `AI_WARMUP=false` in `docker-compose.yml` to skip the startup warm-up prompt (useful because `--reload` re-runs it on every code change).

### Option A: CPU (default, no extra setup)
Steps 4-5 of Getting Started are all you need. Generation is slow on CPU; nginx allows AI requests up to 300 seconds (`proxy_read_timeout` in `nginx.conf`) so long generations don't return `504`.

### Option B: NVIDIA GPU (inside Docker)

#### Requirements
1. NVIDIA GPU with a current driver
2. **Windows:** Docker Desktop with the WSL 2 backend. GPU support is built in; nothing else to install.
3. **Linux:** the NVIDIA Container Toolkit:
```bash
sudo apt-get install -y nvidia-container-toolkit
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker
```
If a native Ollama service is installed on Linux, stop it so it doesn't hold port 11434:
```bash
sudo systemctl disable --now ollama
```

To confirm GPU passthrough works:
```bash
docker run --rm --gpus all nvidia/cuda:<version> nvidia-smi
```
This should list your GPU, driver, and CUDA version. If no GPU is listed, fix that before continuing.

#### Enable the GPU for the Ollama container
Create a file named **`docker-compose.override.yml`** in the repository root (next to `docker-compose.yml`):
```yaml
services:
  ollama:
    deploy:
      resources:
        reservations:
          devices:
            - capabilities: [gpu]
```
This file is **gitignored** and only applies to your machine. Docker Compose automatically merges it with `docker-compose.yml`. YAML uses spaces; do not use tabs.

Then rebuild and pull the model that fits your GPU:
```bash
docker compose up -d --build
docker exec -it ollama ollama pull qwen2.5-coder:14b
docker exec -it ollama ollama pull qwen2.5-coder
```
1. **Up to 8 GB VRAM:** use only `qwen2.5-coder` (~4.7 GB), leaving room for runtime overhead.
2. **12 GB+ VRAM:** `qwen2.5-coder:14b` (~9 GB) gives better responses and is selected automatically.

Using a different model means updating `SMALL_MODEL_NAME` / `LARGE_MODEL_NAME` (or setting `OLLAMA_MODEL`) in `.env`, then `docker compose up -d` to recreate the backend.

*Side note:* `ollama pull <model_name>` downloads a model. `docker exec -it ollama` runs that command inside the container named `ollama`, so the model is stored in the container's `ollama` volume rather than on your host.

### Option C: AMD / Intel GPU (native Ollama)
Docker Desktop cannot pass AMD or Intel GPUs into containers, so run Ollama on the host and point the backend at it.

1. Install Ollama from https://ollama.com/download (it runs in the system tray on Windows/macOS).
2. Pull the model on the host and confirm it runs on the GPU:
   ```bash
   ollama pull qwen2.5-coder:14b
   ollama run qwen2.5-coder:14b "hello"
   ollama ps        # PROCESSOR column should read 100% GPU
   ```
3. Create `docker-compose.override.yml` in the repository root:
   ```yaml
   services:
     backend:
       environment:
         - OLLAMA_URL=http://host.docker.internal:11434/api/generate
         - OLLAMA_MODEL=qwen2.5-coder:14b
     ollama:
       ports: !reset []   # frees port 11434 for the native Ollama
   ```
   `OLLAMA_MODEL` is required because GPU detection only works for NVIDIA. The `ollama` container still starts (the backend depends on it) but is unused.
4. `docker compose up -d --build` and skip step 4 of Getting Started.

If the backend cannot reach the host Ollama, set the environment variable `OLLAMA_HOST=0.0.0.0` for the native Ollama and restart it.

### Checking the models and containers
```bash
docker exec -it ollama ollama list     # Options A and B
ollama list                            # Option C
```
You should see something like:
|NAME | ID | SIZE | MODIFIED|
| ----------------| ----------- | -------------- | --------------|
|qwen2.5-coder:latest | dae161e27b0e | 4.7 GB | 2 minutes ago |
|qwen2.5-coder:14b | 61819fb370a3 | 9.0 GB | 3 minutes ago |

To confirm everything is running:
```bash
docker ps
```
This lists all active containers, including one called **ollama**.

---

## Stopping the Project
```bash
docker compose down
```
This stops all containers but keeps your database data and downloaded models intact.

If you want to stop everything AND wipe the database and models:
```bash
docker compose down -v
```
The `-v` flag deletes all data. Only use this if you want a completely fresh start.

---

## Accessing pgAdmin (Database Browser)
pgAdmin lets you visually browse the database. Useful for checking your data during development.

1. Go to http://localhost:5050
2. Log in with:
   - **Email:** `admin@treenotes.com`
   - **Password:** `admin`
3. To connect to the database, right click **Servers → Register → Server** and fill in:
   - **General tab → Name:** `TreeNotes`
   - **Connection tab → Host:** `db` (not `localhost`; pgAdmin runs in its own container)
   - **Port:** `5432`
   - **Maintenance database:** `treenotes_db`
   - **Username:** `treenotes_user`
   - **Password:** `changeme` (tick **Save password**)
4. Click **Save**, then browse **TreeNotes → Databases → treenotes_db → Schemas → public → Tables**. Right-click a table → **View/Edit Data → All Rows**.

pgAdmin's settings are not persisted, so re-register the server if the `pgadmin` container is recreated.

---

## For the Database & DevOps Role

All Alembic commands need `-c backend/alembic.ini` (see Getting Started, step 6).

### Running migrations
Any time the database schema changes, a new migration file will be added to `backend/migrations/versions/`. To apply it:
```bash
docker compose run --rm backend alembic -c backend/alembic.ini upgrade head
```

### Creating a new migration
If you make changes to `backend/models.py`, generate a new migration with:
```bash
docker compose run --rm backend alembic -c backend/alembic.ini revision --autogenerate -m "describe your change here"
```
Then apply it:
```bash
docker compose run --rm backend alembic -c backend/alembic.ini upgrade head
```

### Rolling back a migration
To undo the last migration:
```bash
docker compose run --rm backend alembic -c backend/alembic.ini downgrade -1
```

### Checking migration status
To see which migrations have been applied:
```bash
docker compose run --rm backend alembic -c backend/alembic.ini current
```

To see the full migration history:
```bash
docker compose run --rm backend alembic -c backend/alembic.ini history
```

---

## Troubleshooting

**`docker compose up -d` fails with "port already in use"**
Something on your machine is already using that port. Either stop that process or change the port in `docker-compose.yml`. A local PostgreSQL service (port 5432) or a native Ollama (port 11434) are the usual causes.

**`No config file 'alembic.ini' found`**
The `-c backend/alembic.ini` flag is missing from the alembic command.

**Database tables don't exist**
You probably haven't run the migrations yet. Run:
```bash
docker compose run --rm backend alembic -c backend/alembic.ini upgrade head
```

**AI panels return `502`**
The backend could not get a response from Ollama: the container isn't running or the selected model isn't pulled. Check `docker exec -it ollama ollama list` and `docker compose logs backend`.

**I want to completely reset everything**
```bash
docker compose down -v
docker compose up -d ollama
docker exec -it ollama ollama pull qwen2.5-coder:latest
docker compose up -d --build
docker compose run --rm backend alembic -c backend/alembic.ini upgrade head
```
