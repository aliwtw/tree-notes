"""hash dev user password

Replaces the placeholder "dev-no-auth-yet" password_hash on the seeded dev
user with a real bcrypt hash so it can be checked by POST /auth/login.

Demo credentials:
    email:    dev@treenotes.local
    password: demo1234

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-08-02 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from passlib.context import CryptContext


revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

users_table = sa.table(
    "users",
    sa.column("id", sa.Integer),
    sa.column("password_hash", sa.String),
)


def upgrade() -> None:
    """Set a real bcrypt hash for the seeded dev user's password."""
    op.execute(
        users_table.update()
        .where(users_table.c.id == 1)
        .values(password_hash=pwd_context.hash("demo1234"))
    )


def downgrade() -> None:
    """Restore the original placeholder password_hash."""
    op.execute(
        users_table.update()
        .where(users_table.c.id == 1)
        .values(password_hash="dev-no-auth-yet")
    )
