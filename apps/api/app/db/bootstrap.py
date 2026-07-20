from __future__ import annotations

from sqlalchemy import select

from app.db.seed import seed_initial_data
from app.db.session import SessionLocal
from app.models import Organization, Role


REQUIRED_ROLE_CODES = frozenset(
    {
        "curator",
        "operation_manager",
        "system_manager",
        "it_admin",
        "reviewer",
        "viewer",
    }
)


def bootstrap_required(*, organization_exists: bool, existing_role_codes: set[str]) -> bool:
    return not organization_exists or not REQUIRED_ROLE_CODES.issubset(existing_role_codes)


def bootstrap_database() -> bool:
    with SessionLocal() as session:
        organization_exists = (
            session.scalar(
                select(Organization.id).where(
                    Organization.code == "default",
                    Organization.deleted_at.is_(None),
                )
            )
            is not None
        )
        existing_role_codes = set(
            session.scalars(
                select(Role.code).where(
                    Role.code.in_(REQUIRED_ROLE_CODES),
                    Role.deleted_at.is_(None),
                )
            ).all()
        )

    if not bootstrap_required(
        organization_exists=organization_exists,
        existing_role_codes=existing_role_codes,
    ):
        return False

    seed_initial_data()
    return True


if __name__ == "__main__":
    bootstrap_database()
