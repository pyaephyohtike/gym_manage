# gym_manage

Gym Management System MVP built with FastAPI and SQLite.

## Features

- Membership plans with four tiers:
  - VIP
  - Gold
  - Silver
  - Normal
- Member management
- Staff management (management, trainer, sales roles)
- Trainer weekly schedule management
- Personal trainer to member assignment
- Appointment booking with conflict checks
- Inventory management and stock adjustments
- Sales management:
  - Member sales
  - Walk-in sales
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
```

## Quick Start

1. Create and activate a virtual environment:

```bash
python -m venv .venv
source .venv/bin/activate
```

2. Install dependencies:

```bash
pip install -r backend/requirements.txt
```

3. Run the API:

```bash
uvicorn backend.app.main:app --reload
```

4. Open docs:

- Swagger UI: `http://127.0.0.1:8000/docs`

## Core API Endpoints

- `GET /api/health`
- `GET/POST /api/membership-plans`
- `GET/POST/PATCH /api/members`
- `GET/POST /api/staff`
- `GET/POST /api/trainer-schedules`
- `GET/POST /api/trainer-assignments`
- `GET/POST/PATCH /api/appointments`
- `GET/POST /api/inventory`
- `POST /api/inventory/{item_id}/adjust`
- `GET/POST /api/sales`

## Tests

Run tests with:

```bash
pytest backend/tests -q
```
