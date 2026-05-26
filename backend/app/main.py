from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from .database import Base, SessionLocal, engine
from .routers.gym import router as gym_router
from .seed import seed_membership_plans


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_membership_plans(db)
        yield
    finally:
        db.close()


app = FastAPI(title="Gym Management System API", version="0.1.0", lifespan=lifespan)
app.include_router(gym_router)
