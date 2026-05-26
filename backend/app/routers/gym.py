from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    Appointment,
    AppointmentStatus,
    InventoryItem,
    Member,
    MembershipPlan,
    PersonalTrainerAssignment,
    Sale,
    SaleItem,
    SaleType,
    Staff,
    StaffRole,
    StockMovement,
    StockMovementType,
    TrainerSchedule,
)
from ..schemas import (
    AppointmentCreate,
    AppointmentOut,
    AppointmentStatusUpdate,
    InventoryAdjustment,
    InventoryItemCreate,
    InventoryItemOut,
    MemberCreate,
    MemberOut,
    MemberUpdate,
    MembershipPlanCreate,
    MembershipPlanOut,
    PersonalTrainerAssignmentCreate,
    PersonalTrainerAssignmentOut,
    SaleCreate,
    SaleOut,
    StaffCreate,
    StaffOut,
    StockMovementOut,
    TrainerScheduleCreate,
    TrainerScheduleOut,
)

router = APIRouter(prefix="/api", tags=["gym-management"])


def is_overlap(start_a: datetime, end_a: datetime, start_b: datetime, end_b: datetime) -> bool:
    return start_a < end_b and start_b < end_a


def normalize_to_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None or dt.tzinfo.utcoffset(dt) is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def require_timezone(dt: datetime, field_name: str) -> None:
    if dt.tzinfo is None or dt.tzinfo.utcoffset(dt) is None:
        raise HTTPException(status_code=400, detail=f"{field_name} must include timezone information")


@router.get("/health")
def health():
    return {"status": "ok", "service": "gym-management-api"}


@router.post("/membership-plans", response_model=MembershipPlanOut, status_code=status.HTTP_201_CREATED)
def create_membership_plan(payload: MembershipPlanCreate, db: Session = Depends(get_db)):
    existing = db.scalar(select(MembershipPlan).where(MembershipPlan.tier == payload.tier))
    if existing:
        raise HTTPException(status_code=409, detail=f"{payload.tier.value} plan already exists")
    plan = MembershipPlan(**payload.model_dump())
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


@router.get("/membership-plans", response_model=list[MembershipPlanOut])
def list_membership_plans(db: Session = Depends(get_db)):
    return list(db.scalars(select(MembershipPlan).order_by(MembershipPlan.id)))


@router.post("/members", response_model=MemberOut, status_code=status.HTTP_201_CREATED)
def create_member(payload: MemberCreate, db: Session = Depends(get_db)):
    plan = db.get(MembershipPlan, payload.plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Membership plan not found")
    member = Member(**payload.model_dump())
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


@router.get("/members", response_model=list[MemberOut])
def list_members(active_only: bool = False, db: Session = Depends(get_db)):
    stmt = select(Member).order_by(Member.id)
    if active_only:
        stmt = stmt.where(Member.is_active.is_(True))
    return list(db.scalars(stmt))


@router.patch("/members/{member_id}", response_model=MemberOut)
def update_member(member_id: int, payload: MemberUpdate, db: Session = Depends(get_db)):
    member = db.get(Member, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    data = payload.model_dump(exclude_unset=True)
    if "plan_id" in data:
        plan = db.get(MembershipPlan, data["plan_id"])
        if not plan:
            raise HTTPException(status_code=404, detail="Membership plan not found")

    for key, value in data.items():
        setattr(member, key, value)
    db.commit()
    db.refresh(member)
    return member


@router.post("/staff", response_model=StaffOut, status_code=status.HTTP_201_CREATED)
def create_staff(payload: StaffCreate, db: Session = Depends(get_db)):
    staff = Staff(**payload.model_dump())
    db.add(staff)
    db.commit()
    db.refresh(staff)
    return staff


@router.get("/staff", response_model=list[StaffOut])
def list_staff(role: StaffRole | None = Query(default=None), db: Session = Depends(get_db)):
    stmt = select(Staff).order_by(Staff.id)
    if role:
        stmt = stmt.where(Staff.role == role)
    return list(db.scalars(stmt))


@router.post("/trainer-schedules", response_model=TrainerScheduleOut, status_code=status.HTTP_201_CREATED)
def create_trainer_schedule(payload: TrainerScheduleCreate, db: Session = Depends(get_db)):
    trainer = db.get(Staff, payload.trainer_id)
    if not trainer or trainer.role != StaffRole.TRAINER:
        raise HTTPException(status_code=404, detail="Trainer not found")
    if payload.start_time >= payload.end_time:
        raise HTTPException(status_code=400, detail="start_time must be before end_time")

    existing_slots = db.scalars(
        select(TrainerSchedule).where(
            and_(TrainerSchedule.trainer_id == payload.trainer_id, TrainerSchedule.weekday == payload.weekday)
        )
    )
    for slot in existing_slots:
        if payload.start_time < slot.end_time and slot.start_time < payload.end_time:
            raise HTTPException(status_code=409, detail="Schedule overlaps with existing slot")

    schedule = TrainerSchedule(**payload.model_dump())
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    return schedule


@router.get("/trainer-schedules/{trainer_id}", response_model=list[TrainerScheduleOut])
def list_trainer_schedule(trainer_id: int, db: Session = Depends(get_db)):
    return list(
        db.scalars(
            select(TrainerSchedule)
            .where(TrainerSchedule.trainer_id == trainer_id)
            .order_by(TrainerSchedule.weekday, TrainerSchedule.start_time)
        )
    )


@router.post("/trainer-assignments", response_model=PersonalTrainerAssignmentOut, status_code=status.HTTP_201_CREATED)
def create_trainer_assignment(payload: PersonalTrainerAssignmentCreate, db: Session = Depends(get_db)):
    member = db.get(Member, payload.member_id)
    trainer = db.get(Staff, payload.trainer_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    if not trainer or trainer.role != StaffRole.TRAINER:
        raise HTTPException(status_code=404, detail="Trainer not found")
    if payload.end_date and payload.end_date < payload.start_date:
        raise HTTPException(status_code=400, detail="end_date cannot be earlier than start_date")

    assignment = PersonalTrainerAssignment(**payload.model_dump())
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return assignment


@router.get("/trainer-assignments", response_model=list[PersonalTrainerAssignmentOut])
def list_trainer_assignments(db: Session = Depends(get_db)):
    return list(db.scalars(select(PersonalTrainerAssignment).order_by(PersonalTrainerAssignment.id)))


@router.post("/appointments", response_model=AppointmentOut, status_code=status.HTTP_201_CREATED)
def create_appointment(payload: AppointmentCreate, db: Session = Depends(get_db)):
    require_timezone(payload.starts_at, "starts_at")
    require_timezone(payload.ends_at, "ends_at")
    starts_at_utc = normalize_to_utc(payload.starts_at)
    ends_at_utc = normalize_to_utc(payload.ends_at)

    if starts_at_utc >= ends_at_utc:
        raise HTTPException(status_code=400, detail="starts_at must be before ends_at")
    if starts_at_utc < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Appointment must be scheduled in the future")

    member = db.get(Member, payload.member_id)
    trainer = db.get(Staff, payload.trainer_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    if not trainer or trainer.role != StaffRole.TRAINER:
        raise HTTPException(status_code=404, detail="Trainer not found")

    weekday = starts_at_utc.weekday()
    trainer_slots = list(
        db.scalars(
            select(TrainerSchedule).where(
                and_(TrainerSchedule.trainer_id == payload.trainer_id, TrainerSchedule.weekday == weekday)
            )
        )
    )
    if trainer_slots:
        appointment_start_time = starts_at_utc.time()
        appointment_end_time = ends_at_utc.time()
        within_slot = any(
            slot.start_time <= appointment_start_time and appointment_end_time <= slot.end_time for slot in trainer_slots
        )
        if not within_slot:
            raise HTTPException(status_code=400, detail="Appointment is outside trainer working schedule")

    booked_appointments = db.scalars(
        select(Appointment).where(
            and_(
                Appointment.status == AppointmentStatus.BOOKED,
                Appointment.trainer_id == payload.trainer_id,
            )
        )
    )
    for existing in booked_appointments:
        if is_overlap(
            normalize_to_utc(existing.starts_at),
            normalize_to_utc(existing.ends_at),
            starts_at_utc,
            ends_at_utc,
        ):
            raise HTTPException(status_code=409, detail="Trainer already has an appointment in this time window")

    member_appointments = db.scalars(
        select(Appointment).where(
            and_(Appointment.status == AppointmentStatus.BOOKED, Appointment.member_id == payload.member_id)
        )
    )
    for existing in member_appointments:
        if is_overlap(
            normalize_to_utc(existing.starts_at),
            normalize_to_utc(existing.ends_at),
            starts_at_utc,
            ends_at_utc,
        ):
            raise HTTPException(status_code=409, detail="Member already has an overlapping appointment")

    appointment = Appointment(**payload.model_dump())
    db.add(appointment)
    db.commit()
    db.refresh(appointment)
    return appointment


@router.get("/appointments", response_model=list[AppointmentOut])
def list_appointments(db: Session = Depends(get_db)):
    return list(db.scalars(select(Appointment).order_by(Appointment.starts_at)))


@router.patch("/appointments/{appointment_id}/status", response_model=AppointmentOut)
def update_appointment_status(appointment_id: int, payload: AppointmentStatusUpdate, db: Session = Depends(get_db)):
    appointment = db.get(Appointment, appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    appointment.status = payload.status
    db.commit()
    db.refresh(appointment)
    return appointment


@router.post("/inventory", response_model=InventoryItemOut, status_code=status.HTTP_201_CREATED)
def create_inventory_item(payload: InventoryItemCreate, db: Session = Depends(get_db)):
    existing = db.scalar(select(InventoryItem).where(InventoryItem.sku == payload.sku))
    if existing:
        raise HTTPException(status_code=409, detail="SKU already exists")
    item = InventoryItem(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("/inventory", response_model=list[InventoryItemOut])
def list_inventory(only_low_stock: bool = False, db: Session = Depends(get_db)):
    stmt = select(InventoryItem).order_by(InventoryItem.id)
    items = list(db.scalars(stmt))
    if only_low_stock:
        items = [item for item in items if item.quantity_on_hand <= item.reorder_level]
    return items


@router.post("/inventory/{item_id}/adjust", response_model=StockMovementOut)
def adjust_inventory(item_id: int, payload: InventoryAdjustment, db: Session = Depends(get_db)):
    if payload.quantity_delta == 0:
        raise HTTPException(status_code=400, detail="quantity_delta cannot be zero")

    item = db.get(InventoryItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    new_quantity = item.quantity_on_hand + payload.quantity_delta
    if new_quantity < 0:
        raise HTTPException(status_code=400, detail="Stock cannot become negative")

    item.quantity_on_hand = new_quantity
    movement = StockMovement(
        item_id=item_id,
        movement_type=StockMovementType.IN if payload.quantity_delta > 0 else StockMovementType.OUT,
        quantity=abs(payload.quantity_delta),
        reason=payload.reason,
    )
    db.add(movement)
    db.commit()
    db.refresh(movement)
    return movement


@router.post("/sales", response_model=SaleOut, status_code=status.HTTP_201_CREATED)
def create_sale(payload: SaleCreate, db: Session = Depends(get_db)):
    if payload.sale_type == SaleType.MEMBER and not payload.member_id:
        raise HTTPException(status_code=400, detail="member_id is required for member sales")
    if payload.sale_type == SaleType.WALKIN and payload.member_id:
        raise HTTPException(status_code=400, detail="member_id must not be provided for walk-in sales")

    if payload.member_id and not db.get(Member, payload.member_id):
        raise HTTPException(status_code=404, detail="Member not found")
    if payload.staff_id and not db.get(Staff, payload.staff_id):
        raise HTTPException(status_code=404, detail="Staff not found")

    sale = Sale(
        sale_type=payload.sale_type,
        member_id=payload.member_id,
        staff_id=payload.staff_id,
        total_amount=0.0,
    )
    db.add(sale)
    db.flush()

    total_amount = 0.0
    for line in payload.items:
        item = db.get(InventoryItem, line.item_id)
        if not item:
            raise HTTPException(status_code=404, detail=f"Inventory item {line.item_id} not found")
        if not item.is_active:
            raise HTTPException(status_code=400, detail=f"Inventory item {item.sku} is inactive")
        if item.quantity_on_hand < line.quantity:
            raise HTTPException(status_code=400, detail=f"Insufficient stock for SKU {item.sku}")

        line_total = round(item.unit_price * line.quantity, 2)
        total_amount += line_total
        item.quantity_on_hand -= line.quantity

        sale_item = SaleItem(
            sale_id=sale.id,
            item_id=item.id,
            quantity=line.quantity,
            unit_price=item.unit_price,
            line_total=line_total,
        )
        db.add(sale_item)

        db.add(
            StockMovement(
                item_id=item.id,
                movement_type=StockMovementType.OUT,
                quantity=line.quantity,
                reason=f"sale:{sale.id}",
            )
        )

    sale.total_amount = round(total_amount, 2)
    db.commit()
    db.refresh(sale)
    return sale


@router.get("/sales", response_model=list[SaleOut])
def list_sales(db: Session = Depends(get_db)):
    return list(db.scalars(select(Sale).order_by(Sale.created_at.desc())))
