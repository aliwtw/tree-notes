# **TreeNotes – AI-Powered Linked Note-Taking Web Application**

## **Running the Stack Locally**

The whole stack runs in Docker. The only requirement is **Docker Desktop** (running), plus roughly 10 GB of free disk space for images and the AI model.

| Service    | What it is                          | Container |
| ---------- | ----------------------------------- | --------- |
| `frontend` | React (Vite) app served by nginx    | nginx forwards `/api/*` to the backend |
| `backend`  | FastAPI (Python)                    | talks to `db` and `ollama` |
| `db`       | PostgreSQL 15                       | data kept in the `postgres_data` volume |
| `pgadmin`  | Database admin UI                   | browser access to `db` |
| `ollama`   | Local LLM runtime for the AI features | models kept in the `ollama` volume |

### Step by step

Commands work in PowerShell and bash unless both forms are shown.

1. **Clone the repository**
   ```bash
   git clone https://github.com/KJ793/tree-notes.git
   cd tree-notes
   ```

2. **Create your `.env`** (the defaults work as-is for local development)
   ```bash
   cp .env.example .env              # bash
   Copy-Item .env.example .env       # PowerShell
   ```

3. **Start Ollama and download the AI model** (~4.7 GB, first run only)
   ```bash
   docker compose up -d ollama
   docker exec -it ollama ollama pull qwen2.5-coder:latest
   docker exec -it ollama ollama list
   ```
   The backend uses `SMALL_MODEL_NAME` (`qwen2.5-coder:latest`) unless it detects an NVIDIA GPU with 12 GB+ of VRAM — see [GPU acceleration](#gpu-acceleration-optional). If the model it asks for is not pulled, the AI panels return `502`.

4. **Build and start the full stack**
   ```bash
   docker compose up -d --build
   ```

5. **Apply the database migrations** (first run, and whenever a new migration is added). This creates the tables and the demo user. `-c` is required because `alembic.ini` lives in `backend/`, not the container's working directory.
   ```bash
   docker compose run --rm backend alembic -c backend/alembic.ini upgrade head
   docker compose run --rm backend alembic -c backend/alembic.ini current
   ```

6. **Verify everything is up**
   ```bash
   docker compose ps
   curl http://localhost:8000/health        # backend directly     -> {"status":"ok"}
   curl http://localhost:8080/api/health    # through nginx proxy  -> {"status":"ok"}
   curl http://localhost:11434              # -> "Ollama is running"
   ```
   In PowerShell use `curl.exe` instead of `curl`. On startup the backend sends a warm-up prompt to Ollama; follow it with `docker compose logs -f backend`. On CPU the first model load can take a minute.

7. **Open the app** at http://localhost:8080 and log in with the demo user below.

### URLs

| What                 | URL                                  | Notes |
| -------------------- | ------------------------------------ | ----- |
| Frontend             | http://localhost:8080                | |
| Backend API docs     | http://localhost:8000/docs           | Swagger UI |
| Backend health       | http://localhost:8000/health         | via nginx: http://localhost:8080/api/health |
| Ollama               | http://localhost:11434               | installed models: http://localhost:11434/api/tags |
| pgAdmin (database UI)| http://localhost:5050                | bound to localhost only |
| PostgreSQL           | `localhost:5432`                     | not a web page; for desktop clients (psql, DBeaver). Bound to localhost only |

### Credentials

| Purpose                     | Field          | Value |
| --------------------------- | -------------- | ----- |
| App demo user (frontend)    | Email          | `dev@treenotes.local` |
|                             | Password       | `demo1234` |
| pgAdmin login               | Email          | `admin@treenotes.com` |
|                             | Password       | `admin` |
| PostgreSQL                  | Host           | `db` from pgAdmin; `localhost` from desktop clients |
|                             | Port           | `5432` |
|                             | Database       | `treenotes_db` |
|                             | Username       | `treenotes_user` |
|                             | Password       | `changeme` |

The pgAdmin and PostgreSQL values come from `.env`; the demo user is seeded by a database migration. Change them before deploying anywhere other than your own machine.

### Browsing the database in pgAdmin

1. Open http://localhost:5050 (allow 10–20 seconds on first start) and log in with `admin@treenotes.com` / `admin`.
2. In the left tree, right-click **Servers → Register → Server…** (or click **Add New Server** on the dashboard).
3. **General** tab: set **Name** to `TreeNotes`.
4. **Connection** tab:
   - **Host name/address:** `db` — not `localhost`, which inside the pgAdmin container refers to pgAdmin itself
   - **Port:** `5432`
   - **Maintenance database:** `treenotes_db`
   - **Username:** `treenotes_user`
   - **Password:** `changeme` (tick **Save password**)
5. Click **Save**, then expand **TreeNotes → Databases → treenotes_db → Schemas → public → Tables**.
6. Right-click a table (e.g. `users`) → **View/Edit Data → All Rows**, or open **Tools → Query Tool** to run SQL.

pgAdmin's settings are not stored in a volume, so the server registration has to be repeated if the `pgadmin` container is recreated.

### GPU acceleration (optional)

By default the `ollama` container runs on the CPU. That works, but generation is slow. nginx allows AI requests up to 300 seconds (`proxy_read_timeout` in `nginx.conf`) so long generations don't fail with a `504`.

Model selection happens in `backend/ai/ai.py`: `OLLAMA_MODEL` is used if set; otherwise `LARGE_MODEL_NAME` if `nvidia-smi` inside the `ollama` container reports 12 GB+ of VRAM; otherwise `SMALL_MODEL_NAME`.

**NVIDIA GPU** — create `docker-compose.override.yml` in the repo root (gitignored, merged automatically by Docker Compose):
```yaml
services:
  ollama:
    deploy:
      resources:
        reservations:
          devices:
            - capabilities: [gpu]
```
Then `docker compose up -d`, and pull the large model if you have 12 GB+ of VRAM: `docker exec -it ollama ollama pull qwen2.5-coder:14b`. Docker Desktop on Windows supports NVIDIA GPUs through WSL 2; on Linux, install the NVIDIA Container Toolkit first (see DEVELOPMENT.md).

**AMD / Intel GPU** — Docker Desktop cannot pass these GPUs into a container, so run Ollama natively instead:
1. Install Ollama from https://ollama.com/download and pull the model on the host: `ollama pull qwen2.5-coder:14b` (or `qwen2.5-coder:latest` for less than 12 GB of VRAM).
2. Check it is on the GPU: `ollama run qwen2.5-coder:14b "hello"`, then `ollama ps` should show `100% GPU`.
3. Create `docker-compose.override.yml` in the repo root. `OLLAMA_MODEL` is required because GPU detection only works for NVIDIA:
   ```yaml
   services:
     backend:
       environment:
         - OLLAMA_URL=http://host.docker.internal:11434/api/generate
         - OLLAMA_MODEL=qwen2.5-coder:14b
     ollama:
       ports: !reset []   # frees port 11434 for the native Ollama
   ```
4. `docker compose up -d --build`. Skip step 3 of the main guide; the `ollama` container still starts but is unused. If the backend cannot reach the host, set the environment variable `OLLAMA_HOST=0.0.0.0` for the native Ollama and restart it.

### Stopping and resetting

```bash
docker compose down                 # stop everything; database and models are kept
docker compose down -v              # also delete the database and downloaded models
```
After `down -v`, repeat steps 3–5.

### Troubleshooting

- **Port 5432 (or 8080/8000/5050/11434) already in use** — another program holds the port. For a local PostgreSQL on Windows, run `Stop-Service postgresql-x64-18` as Administrator (version number may differ). For a native Ollama, quit it from the system tray.
- **Login fails or "relation does not exist" errors** — the migrations have not run; repeat step 5.
- **AI panels return `502`** — Ollama is unreachable or the model isn't pulled. Check `docker exec -it ollama ollama list` and `docker compose logs backend`.

For migrations, the branch workflow, and CI, see DEVELOPMENT.md, GIT_WORKFLOW.md, and DEVOPS_GUIDE.md.

---

**Project Proposal**

---

## 1. **Project Overview**

TreeNotes is an **open-source** web application designed to help students, researchers, and professionals capture, organize, and interconnect ideas effectively.

It combines the **Cornell Note-Taking Method** with a **network-based knowledge model**, where each note becomes a “node” in a graph, and relationships between ideas are represented as links between these nodes. This lets users visualize and explore how their notes and concepts relate, rather than seeing them as isolated entries.

An **AI module** powered by **Large Language Models (LLMs)** through **Ollama** will analyze note content, automatically create nodes for key ideas, and establish links between related concepts. Users can also manually create and connect notes for full control over their knowledge map.

> **Current Progress**: The project already has a **basic structure skeleton** in place, with manual notes creation and linking functionality. The next phase will focus on integrating AI-powered features, database setup, improving the UI/UX, and optimizing performance.

---

## 2. **Key Features**

### **Current Implemented Features**

* Skeleton architecture for frontend (React + Vite) and backend (FastAPI).
* PostgreSQL database configured for storing notes and links.
* Manual creation and linking of notes via a simple interface.
* Docker setup for running services locally.

### **Planned Features**

1. **AI-Assisted Linking** – Analyze text and auto-create relationships between concepts.
2. **Enhanced the Cornell Method Support** – Cue, note, and summary sections in every note.
3. **Graph Visualization** – Interactive network map showing relationships.
4. **Semantic Search** – Use AI to find relevant notes by meaning, not just keywords.
5. **User Interface Improvements** – More intuitive linking and navigation tools.

---

## 3. **Technical Stack**

* **Frontend:** React (Vite), served by nginx
* **Backend:** FastAPI (Python) – for API endpoints, AI processing, and database access
* **Database:** PostgreSQL – for storing notes, nodes, and relationships
* **AI Processing:** LLMs via Ollama for concept extraction and relationship mapping
* **Deployment:** Docker containers for isolated, reproducible environments

---

## 4. **System Architecture**

```
[Frontend: React + nginx]
     ↓
[Backend: FastAPI]
     ├── AI Module (Ollama LLM for Concept Linking)
     └── Database Layer (PostgreSQL)
     ↓
[Docker Environment]
```

---

## 5. **AI Functionality (via Ollama LLMs)**

The AI module will:

1. Parse and analyze note text using a locally hosted or remote LLM.
2. Identify important concepts and topics.
3. Suggest or automatically create linked nodes.
4. Enable semantic search queries.

---

## 6. **Why TreeNotes is Valuable for Students**

TreeNotes will help students:

* Organize information using a proven method (The Cornell Note-Taking).
* Discover hidden connections between concepts.
* Reduce study time through AI-assisted linking and search.
* Practice working with modern AI and web development tools.

---

## 7. **Learning Outcomes for Students**

Students contributing to TreeNotes will learn:

* **Frontend Development** with HTML/CSS/JS.
* **Backend Development** with FastAPI.
* **Database Design & SQL** with PostgreSQL.
* **AI Integration** using Ollama for semantic analysis.
* **Containerization** with Docker.
* **Agile Project Management** for long-term team projects.
* **Open Source Collaboration** through GitHub workflows.

---

## 8. **Open Source Vision**

TreeNotes will remain open source on GitHub, enabling the community to:

* Suggest new features
* Improve AI models and linking logic
* Contribute UI enhancements

---

## 9. **TreeNotes – Parallel 8-Month Timeline (minimum 4-Person Team)**

| Month | Frontend (Person A)                                | Backend (Person B)                          | AI Integration (Person C)                       | Database & DevOps (Person D)                    |
| ----- | -------------------------------------------------- | ------------------------------------------- | ----------------------------------------------- | ----------------------------------------------- |
| **1** | Review existing skeleton UI, refine layout plan    | Review FastAPI structure, refine API routes | Research Ollama LLM capabilities & requirements | Review PostgreSQL schema, optimize Docker setup |
| **2** | Create wireframes, improve note creation UI        | Implement enhanced note CRUD endpoints      | Build prototype text analysis with sample notes | Design final DB schema for nodes & links        |
| **3** | Add manual linking UI with drag/drop graph         | Connect manual linking endpoints to DB      | Create AI service endpoint in FastAPI           | Implement DB changes & relationships            |
| **4** | Integrate frontend calls to AI suggestion endpoint | Optimize backend for AI request handling    | Train/tune AI prompts for concept extraction    | Set up Docker multi-container orchestration     |
| **5** | Develop graph visualization component              | Support graph data retrieval API            | Implement automatic node & link creation        | Add DB indexing for fast graph queries          |
| **6** | Enhance the Cornell Method input templates            | Add semantic search endpoints               | Integrate semantic search using LLM             | Optimize queries for semantic matching          |
| **7** | UI polish, mobile-friendly layout                  | API load testing & bug fixes                | AI performance optimization & caching           | CI/CD pipeline for deployment                   |
| **8** | Final UI testing & documentation                   | Backend documentation & code cleanup        | AI usage guide & examples                       | Deployment scripts & final Docker images        |

---

### **Parallel Work Highlights**

* **Team Collaboration Points:**

  * **Monthly Syncs** to integrate work from all streams.
  * **Weekly Check-ins** to solve blockers early.
* **Shared Responsibility:** Testing and debugging will be cross-functional in months 6–8.
* **Overlap:** AI and Backend will collaborate closely from Month 3 onward for endpoint design; Frontend and Database will coordinate for efficient data visualization.

---

## Speech Recognition

TreeNotes uses a locally hosted Vosk ASR service.

The default Docker build automatically downloads:

vosk-model-small-en-us-0.15

No manual model installation is required.

Start the full TreeNotes stack with:

docker compose up -d --build

The Vosk WebSocket service is exposed locally on:

ws://localhost:2700

The first ASR build may take longer because the language model must
be downloaded and added to the Docker image.