from datetime import date, datetime, time, timezone
from enum import Enum

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum as SqlEnum,
    Float,
    ForeignKey,
    Integer,
    String,
    Time,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class MembershipTier(str, Enum):
    VIP = "vip"
    GOLD = "gold"
    SILVER = "silver"
    NORMAL = "normal"


class StaffRole(str, Enum):
    MANAGEMENT = "management"
    TRAINER = "trainer"
    SALES = "sales"


class AppointmentStatus(str, Enum):
    BOOKED = "booked"
    COMPLETED = "completed"
    CANCELED = "canceled"
    NO_SHOW = "no_show"


class SaleType(str, Enum):
    MEMBER = "member"
    WALKIN = "walkin"


class StockMovementType(str, Enum):
    IN = "in"
    OUT = "out"


class MembershipPlan(Base):
    __tablename__ = "membership_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tier: Mapped[MembershipTier] = mapped_column(SqlEnum(MembershipTier), unique=True, nullable=False)
    monthly_fee: Mapped[float] = mapped_column(Float, nullable=False)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    members: Mapped[list["Member"]] = relationship(back_populates="plan")


class Member(Base):
    __tablename__ = "members"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(30), unique=True, nullable=True)
    email: Mapped[str | None] = mapped_column(String(120), unique=True, nullable=True)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    plan_id: Mapped[int] = mapped_column(ForeignKey("membership_plans.id"), nullable=False)

    plan: Mapped["MembershipPlan"] = relationship(back_populates="members")
    appointments: Mapped[list["Appointment"]] = relationship(back_populates="member")
    trainer_links: Mapped[list["PersonalTrainerAssignment"]] = relationship(back_populates="member")
    sales: Mapped[list["Sale"]] = relationship(back_populates="member")


class Staff(Base):
    __tablename__ = "staff"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    role: Mapped[StaffRole] = mapped_column(SqlEnum(StaffRole), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(30), unique=True, nullable=True)
    email: Mapped[str | None] = mapped_column(String(120), unique=True, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    schedule_slots: Mapped[list["TrainerSchedule"]] = relationship(back_populates="trainer")
    appointments: Mapped[list["Appointment"]] = relationship(back_populates="trainer")
    assigned_members: Mapped[list["PersonalTrainerAssignment"]] = relationship(back_populates="trainer")
    sales: Mapped[list["Sale"]] = relationship(back_populates="staff")


class TrainerSchedule(Base):
    __tablename__ = "trainer_schedules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    trainer_id: Mapped[int] = mapped_column(ForeignKey("staff.id"), nullable=False)
    weekday: Mapped[int] = mapped_column(Integer, nullable=False)  # 0=Monday, 6=Sunday
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)

    trainer: Mapped["Staff"] = relationship(back_populates="schedule_slots")


class PersonalTrainerAssignment(Base):
    __tablename__ = "personal_trainer_assignments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    member_id: Mapped[int] = mapped_column(ForeignKey("members.id"), nullable=False)
    trainer_id: Mapped[int] = mapped_column(ForeignKey("staff.id"), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    member: Mapped["Member"] = relationship(back_populates="trainer_links")
    trainer: Mapped["Staff"] = relationship(back_populates="assigned_members")


class Appointment(Base):
    __tablename__ = "appointments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    member_id: Mapped[int] = mapped_column(ForeignKey("members.id"), nullable=False)
    trainer_id: Mapped[int] = mapped_column(ForeignKey("staff.id"), nullable=False)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[AppointmentStatus] = mapped_column(
        SqlEnum(AppointmentStatus), default=AppointmentStatus.BOOKED, nullable=False
    )
    notes: Mapped[str | None] = mapped_column(String(255), nullable=True)

    member: Mapped["Member"] = relationship(back_populates="appointments")
    trainer: Mapped["Staff"] = relationship(back_populates="appointments")


class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    sku: Mapped[str] = mapped_column(String(60), unique=True, nullable=False)
    unit_price: Mapped[float] = mapped_column(Float, nullable=False)
    quantity_on_hand: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    reorder_level: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    stock_movements: Mapped[list["StockMovement"]] = relationship(back_populates="item")
    sale_items: Mapped[list["SaleItem"]] = relationship(back_populates="item")


class StockMovement(Base):
    __tablename__ = "stock_movements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("inventory_items.id"), nullable=False)
    movement_type: Mapped[StockMovementType] = mapped_column(SqlEnum(StockMovementType), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    item: Mapped["InventoryItem"] = relationship(back_populates="stock_movements")


class Sale(Base):
    __tablename__ = "sales"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    sale_type: Mapped[SaleType] = mapped_column(SqlEnum(SaleType), nullable=False)
    member_id: Mapped[int | None] = mapped_column(ForeignKey("members.id"), nullable=True)
    staff_id: Mapped[int | None] = mapped_column(ForeignKey("staff.id"), nullable=True)
    total_amount: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    member: Mapped["Member | None"] = relationship(back_populates="sales")
    staff: Mapped["Staff | None"] = relationship(back_populates="sales")
    items: Mapped[list["SaleItem"]] = relationship(back_populates="sale", cascade="all, delete-orphan")


class SaleItem(Base):
    __tablename__ = "sale_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    sale_id: Mapped[int] = mapped_column(ForeignKey("sales.id"), nullable=False)
    item_id: Mapped[int] = mapped_column(ForeignKey("inventory_items.id"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[float] = mapped_column(Float, nullable=False)
    line_total: Mapped[float] = mapped_column(Float, nullable=False)

    sale: Mapped["Sale"] = relationship(back_populates="items")
    item: Mapped["InventoryItem"] = relationship(back_populates="sale_items")
