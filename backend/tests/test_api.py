from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.database import Base, get_db
from backend.app.main import app
from backend.app.models import MembershipPlan, MembershipTier


@pytest.fixture()
def client(tmp_path):
    test_db_path = tmp_path / "test.db"
    engine = create_engine(f"sqlite:///{test_db_path}", connect_args={"check_same_thread": False})
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    db = TestingSessionLocal()
    for tier, fee in [
        (MembershipTier.VIP, 120.0),
        (MembershipTier.GOLD, 90.0),
        (MembershipTier.SILVER, 65.0),
        (MembershipTier.NORMAL, 45.0),
    ]:
        db.add(MembershipPlan(tier=tier, monthly_fee=fee, description=f"{tier.value} plan"))
    db.commit()
    db.close()

    def override_get_db():
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_member_sale_reduces_inventory(client: TestClient):
    inventory_response = client.post(
        "/api/inventory",
        json={
            "name": "Whey Protein",
            "sku": "WHEY-01",
            "unit_price": 40,
            "quantity_on_hand": 10,
            "reorder_level": 2,
        },
    )
    assert inventory_response.status_code == 201
    item_id = inventory_response.json()["id"]

    members_response = client.get("/api/membership-plans")
    normal_plan = [plan for plan in members_response.json() if plan["tier"] == "normal"][0]
    member_response = client.post(
        "/api/members",
        json={
            "full_name": "John Doe",
            "phone": "1234567890",
            "email": "john@example.com",
            "plan_id": normal_plan["id"],
        },
    )
    assert member_response.status_code == 201
    member_id = member_response.json()["id"]

    sale_response = client.post(
        "/api/sales",
        json={
            "sale_type": "member",
            "member_id": member_id,
            "items": [{"item_id": item_id, "quantity": 2}],
        },
    )
    assert sale_response.status_code == 201
    assert sale_response.json()["total_amount"] == 80.0

    inventory_list = client.get("/api/inventory").json()
    assert inventory_list[0]["quantity_on_hand"] == 8


def test_appointment_conflict_is_rejected(client: TestClient):
    plan = client.get("/api/membership-plans").json()[0]
    member = client.post(
        "/api/members",
        json={
            "full_name": "Anna Member",
            "phone": "2234567890",
            "email": "anna@example.com",
            "plan_id": plan["id"],
        },
    ).json()

    trainer = client.post(
        "/api/staff",
        json={
            "full_name": "Tom Trainer",
            "role": "trainer",
            "phone": "9988776655",
            "email": "trainer@example.com",
        },
    ).json()

    now = datetime.now(timezone.utc) + timedelta(days=1)
    start = now.replace(hour=9, minute=0, second=0, microsecond=0)
    end = now.replace(hour=10, minute=0, second=0, microsecond=0)

    first = client.post(
        "/api/appointments",
        json={
            "member_id": member["id"],
            "trainer_id": trainer["id"],
            "starts_at": start.isoformat(),
            "ends_at": end.isoformat(),
        },
    )
    assert first.status_code == 201

    second = client.post(
        "/api/appointments",
        json={
            "member_id": member["id"],
            "trainer_id": trainer["id"],
            "starts_at": (start + timedelta(minutes=30)).isoformat(),
            "ends_at": (end + timedelta(minutes=30)).isoformat(),
        },
    )
    assert second.status_code == 409
