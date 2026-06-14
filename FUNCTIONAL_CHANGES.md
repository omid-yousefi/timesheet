# Functional Fixes & Improvements — Summary

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
The UI was kept intact; only behavior/integration was changed. All displayed dates
use the Persian (Jalali) calendar.

## 1. Manager capability — view & edit employees' daily reports

**New page:** `frontend/app/manager/reports/page.tsx` (linked from the nav as
“ویرایش گزارش‌ها” for managers & admins in `components/Shell.tsx`).

- Filter by **employee** (dropdown limited to the manager's department) and by
  **Jalali date** (Jalali calendar picker).
- Full CRUD for the selected employee/day: **edit, add, and delete** entries
  (inline forms, 24-hour times, auto-derived activity description).

**Backend (`backend/app/api/routes/manager.py`):**

- `GET  /manager/employees` — department-scoped employee list (admins see all,
  admin accounts excluded).
- `GET  /manager/employees/{id}/reports?work_date=YYYY-MM-DD` — one day's entries.
- `POST /manager/employees/{id}/reports` — add an entry on the employee's behalf.
- `PUT  /manager/employees/{id}/reports/{report_id}` — edit an entry.
- `DELETE /manager/employees/{id}/reports/{report_id}` — delete an entry.
- `GET  /manager/employees/{id}/tasks` — tasks+todos for the employee's department.
- All routes enforce department ownership for managers (cross-department → 403),
  validate task/todo, prevent overlapping time intervals, and write audit logs.

## 2. Daily report submission — no date field, today only

`frontend/app/logs/page.tsx`:

- Removed the editable date picker from the submission form.
- Shows **today's Jalali date in bold/highlighted** (e.g. «شنبه ۲۴ خرداد ۱۴۰۵»).
- Submission always uses today's date.

**Backend (`backend/app/api/routes/timesheets.py`):** the “current day only”
restriction still applies to employees; **managers and admins bypass it** so they
can correct past days (requirement #1).

## 3. Time format — 24-hour

Start/end times use native `type="time"` with `step={60}` (24-hour values such as
`16:00`) on both the submission form and the manager edit form.

## 4. Report history — pagination + Jalali date filter

`frontend/app/logs/page.tsx` + `GET /timesheets/history`:

- Pagination retained.
- Added a **Jalali date filter** (picker → converted to Gregorian → backend
  `?work_date=` filter). “Clear filter” returns to all entries.

## 5. Dashboard improvements

- **Interactive trend chart:** `components/Charts.tsx` `PeriodTrend` was rewritten
  from a static SVG to a recharts `LineChart` with hover tooltips showing each
  point's value.
- **Department average overlaid:** the trend chart now draws the user's metric and
  the **department average** for the same metric/day as a second (dashed) line.
  `app/dashboard/page.tsx` feeds it both `breakdown` and `department_breakdown`.
- **Date shift fixed:** the root cause was the frontend converting dates through
  `new Date("YYYY-MM-DD")` (parsed as UTC midnight, shifting by a day) and the
  unreliable `react-date-object .convert()` during submission. Introduced
  `frontend/lib/jalali.ts` — timezone-safe, dependency-free Jalali↔Gregorian
  conversion that matches the backend algorithm exactly. The chart now uses the
  backend's already-correct Jalali labels, and history/manager views use the new
  helpers. `1405/03/24` now round-trips correctly (no more `1405/03/25`).

## Files

- **Modified:** `backend/app/api/routes/manager.py`,
  `backend/app/api/routes/timesheets.py`, `frontend/app/dashboard/page.tsx`,
  `frontend/app/logs/page.tsx`, `frontend/components/Charts.tsx`,
  `frontend/components/Shell.tsx`.
- **Added (unavoidable):** `frontend/app/manager/reports/page.tsx` (new manager
  page, per request) and `frontend/lib/jalali.ts` (shared date utility reused by
  logs, dashboard and manager pages to keep conversions consistent).

## Verification

- `npm run build` (Next.js) passes type-checking with all routes generated.
- Backend imports cleanly; manager CRUD, department scoping, date filtering, and
  the same-day bypass were exercised via a `TestClient` run and all pass.
