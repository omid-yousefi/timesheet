# Enterprise Timesheet & Productivity Analytics Platform

Production-oriented internal app scaffold for فارسی/RTL timesheet management and productivity analytics.

## Quick start

```bash
cp .env.example .env
docker compose up --build
```

- Web app: http://localhost
- API docs: http://localhost/docs

See `docs/ARCHITECTURE.md` for schema, ERD, API, formulas, wireframes, roadmap, and deployment guide.

## Important security rule

Employees can select `Task` and `To Do`, but never receive or see `Priority` or `Weight`. These are only used server-side for KPI calculations.
