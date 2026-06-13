# Authentication & Admin-Task Implementation — Summary

## Root cause of the `403 Not authenticated` errors

`.gitignore` contained `**/lib/`, which silently excluded the entire `frontend/lib/`
directory from version control. As a result the **`@/lib/api` module that every page
imports never existed in the repo**. Without an API client, the `Authorization: Bearer
<token>` header was never attached to requests, so FastAPI's `HTTPBearer()` returned
`403 Not authenticated` on every protected route.

## What changed

### 1. Authentication (frontend)
- **`frontend/lib/auth.ts`** *(new)* — token/role helpers around `localStorage`.
- **`frontend/lib/api.ts`** *(new)* — typed `fetch` wrapper that attaches the JWT,
  serializes JSON vs `FormData`, and redirects to `/login` on expired/missing tokens.
- **`frontend/components/Shell.tsx`** — now a client component that acts as an
  **auth guard** for every protected page (validates token via `/me`), shows a logout
  button, and renders role-based navigation.
- **`frontend/app/login/page.tsx`** — proper form with loading/error states and
  `next/router` navigation.
- **`frontend/app/page.tsx`** — redirects to `/dashboard` or `/login` based on token.

### 2. Credentials (`admin` / `Admin123`)
- **`.env`** *(new, git-ignored)* — stores `ADMIN_USERNAME` / `ADMIN_PASSWORD=Admin123`,
  a real `SECRET_KEY`, and `NEXT_PUBLIC_API_URL`.
- **`backend/app/core/config.py`** — loads `admin_username` / `admin_password` /
  `admin_department` from the environment.
- **`backend/scripts/seed_admin.py`** — now reads credentials from settings (no
  hard-coded password) and is **idempotent**.
- **`docker-compose.yml`** — passes the admin env vars and runs `seed_admin.py`
  after migrations on first boot.
- **`.env.example`** — documents all variables.

### 3. Admin: create tasks per department (Task Title, Priority, Quality, Weight)
- **`backend/app/schemas/admin.py`** — `TaskCreate` schema (validated range/length).
- **`backend/app/schemas/task.py`** — `TaskAdminOut` / `TodoAdminOut` for rich output.
- **`backend/app/api/routes/admin.py`** — `POST /admin/tasks` and `GET /admin/tasks`.
  Mapping follows the existing Excel contract: `name`→task, `quality`→todo title,
  `priority`/`weight`→todo KPI fields.
- **`frontend/app/admin/page.tsx`** — new **“وظایف”** tab with the 4-field form and
  a live task list (grouped by department).

### 4. Production-readiness fixes
- **`backend/app/core/security.py`** — replaced broken `passlib 1.7.4` (incompatible
  with `bcrypt≥4.1`, crashes on every password hash) with direct `bcrypt` usage.
- **`backend/requirements.txt`** — `passlib[bcrypt]` → `bcrypt==4.2.1`.
- **`backend/app/api/routes/admin.py`** — `update_user` now uses an allow-listed
  `UserUpdate` schema instead of an arbitrary `dict` (prevents mass-assignment).
  Added 404/409 guards on user/department/task creation.
- **`frontend/app/logs/page.tsx`** — fixed a pre-existing TypeScript type mismatch
  (`focused_minutes` number vs string).
- **`frontend/Dockerfile`** — multi-stage **standalone** build, non-root user,
  telemetry disabled.
- **`nginx/nginx.conf`** — added security headers + WebSocket upgrade headers.
- **`.gitignore`** — removed the `**/lib/` rule that hid the API client.

## Run it

```bash
cp .env.example .env       # then edit secrets
docker compose up --build
# open http://localhost  →  log in with admin / Admin123
```

For local frontend dev (outside Docker) the backend runs at `http://localhost:8000`
(see `frontend/.env.local`) and a dev DB/seed is created via `scripts/seed_admin.py`.
