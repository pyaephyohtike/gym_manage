# gym_manage

Gym Management System MVP with a FastAPI backend and React dashboard frontend.

## Features

- Membership plans with four tiers: VIP, Gold, Silver, Normal
- Member management
- Staff management (management, trainer, sales roles)
- Trainer weekly schedule management
- Personal trainer to member assignment
- Appointment booking with conflict checks and status updates
- Inventory management and stock adjustments
- Sales management (member sales + walk-in sales)
- Automatic stock deduction for sales

## Project Structure

```text
backend/
  app/
    database.py
    main.py
    models.py
    schemas.py
    seed.py
    routers/
      gym.py
  tests/
    test_api.py
  requirements.txt

frontend/
  src/
    App.tsx
    api.ts
    types.ts
    styles.css
  package.json
  vite.config.ts
```

## Run Backend API

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.app.main:app --reload
```

API docs: `http://127.0.0.1:8000/docs`

## Run Frontend Dashboard

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Dashboard URL: `http://127.0.0.1:5173`

Optional API base override:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8000 npm run dev
```

## Frontend Dashboard Modules

- **Members**: add members, view plans and member list
- **Appointments Calendar**: weekly calendar, booking form, appointment status update
- **Inventory POS**: add inventory, stock adjustments, member/walk-in sales
- **Staff & Schedules**: add staff, configure trainer slots, assign personal trainers

## Tests

Run backend tests:

```bash
python3 -m pytest backend/tests -q
```
