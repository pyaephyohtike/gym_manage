from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import MembershipPlan, MembershipTier


DEFAULT_PLANS = [
    (MembershipTier.VIP, 120.0, "VIP plan with premium perks and priority slots"),
    (MembershipTier.GOLD, 90.0, "Gold plan with full gym and class access"),
    (MembershipTier.SILVER, 65.0, "Silver plan with standard gym access"),
    (MembershipTier.NORMAL, 45.0, "Normal plan with essential membership benefits"),
]


def seed_membership_plans(db: Session) -> None:
    existing_tiers = {plan.tier for plan in db.scalars(select(MembershipPlan))}
    for tier, fee, description in DEFAULT_PLANS:
        if tier in existing_tiers:
            continue
        db.add(MembershipPlan(tier=tier, monthly_fee=fee, description=description))
    db.commit()
