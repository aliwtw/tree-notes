#seeded dev user

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa



revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "1991ad542d07"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None



users_table = sa.table(
    "users",
    sa.column("id", sa.Integer),
    sa.column("username", sa.String),
    sa.column("email", sa.String),
    sa.column("password_hash", sa.String),
    sa.column("is_active", sa.Boolean),
)


def upgrade() -> None:
    op.bulk_insert(
        users_table,
        [
            {
                "id": 1,
                "username": "devuser",
                "email": "dev@treenotes.local",
                "password_hash": "dev-no-auth-yet",
                "is_active": True,
            }
        ],
    )


    op.execute(
        "SELECT setval('users_id_seq', "
        "(SELECT COALESCE(MAX(id), 1) FROM users))"
    )


def downgrade() -> None:
    op.execute("DELETE FROM users WHERE id = 1")