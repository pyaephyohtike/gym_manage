from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict, Field

from .models import (
    AppointmentStatus,
    MembershipTier,
    SaleType,
    StaffRole,
    StockMovementType,
)


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class MembershipPlanCreate(BaseModel):
    tier: MembershipTier
    monthly_fee: float = Field(gt=0)
    description: str | None = None


class MembershipPlanOut(ORMModel):
    id: int
    tier: MembershipTier
    monthly_fee: float
    description: str | None = None


class MemberCreate(BaseModel):
    full_name: str
    phone: str | None = None
    email: str | None = None
    plan_id: int


class MemberUpdate(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    email: str | None = None
    plan_id: int | None = None
    is_active: bool | None = None


class MemberOut(ORMModel):
    id: int
    full_name: str
    phone: str | None = None
    email: str | None = None
    joined_at: datetime
    is_active: bool
    plan_id: int


class StaffCreate(BaseModel):
    full_name: str
    role: StaffRole
    phone: str | None = None
    email: str | None = None


class StaffOut(ORMModel):
    id: int
    full_name: str
    role: StaffRole
    phone: str | None = None
    email: str | None = None
    is_active: bool


class TrainerScheduleCreate(BaseModel):
    trainer_id: int
    weekday: int = Field(ge=0, le=6)
    start_time: time
    end_time: time


class TrainerScheduleOut(ORMModel):
    id: int
    trainer_id: int
    weekday: int
    start_time: time
    end_time: time


class PersonalTrainerAssignmentCreate(BaseModel):
    member_id: int
    trainer_id: int
    start_date: date
    end_date: date | None = None
    is_active: bool = True


class PersonalTrainerAssignmentOut(ORMModel):
    id: int
    member_id: int
    trainer_id: int
    start_date: date
    end_date: date | None = None
    is_active: bool


class AppointmentCreate(BaseModel):
    member_id: int
    trainer_id: int
    starts_at: datetime
    ends_at: datetime
    notes: str | None = None


class AppointmentStatusUpdate(BaseModel):
    status: AppointmentStatus


class AppointmentOut(ORMModel):
    id: int
    member_id: int
    trainer_id: int
    starts_at: datetime
    ends_at: datetime
    status: AppointmentStatus
    notes: str | None = None


class InventoryItemCreate(BaseModel):
    name: str
    sku: str
    unit_price: float = Field(gt=0)
    quantity_on_hand: int = Field(ge=0, default=0)
    reorder_level: int = Field(ge=0, default=5)


class InventoryItemOut(ORMModel):
    id: int
    name: str
    sku: str
    unit_price: float
    quantity_on_hand: int
    reorder_level: int
    is_active: bool


class InventoryAdjustment(BaseModel):
    quantity_delta: int
    reason: str = Field(min_length=2, max_length=255)


class StockMovementOut(ORMModel):
    id: int
    item_id: int
    movement_type: StockMovementType
    quantity: int
    reason: str
    created_at: datetime


class SaleLineCreate(BaseModel):
    item_id: int
    quantity: int = Field(gt=0)


class SaleCreate(BaseModel):
    sale_type: SaleType
    member_id: int | None = None
    staff_id: int | None = None
    items: list[SaleLineCreate] = Field(min_length=1)


class SaleItemOut(ORMModel):
    id: int
    item_id: int
    quantity: int
    unit_price: float
    line_total: float


class SaleOut(ORMModel):
    id: int
    sale_type: SaleType
    member_id: int | None = None
    staff_id: int | None = None
    total_amount: float
    created_at: datetime
    items: list[SaleItemOut]
