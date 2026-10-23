"""lowercase stored user emails

Register, login and profile update now lowercase email addresses before
storing or looking them up. This brings existing rows into line, so an account
created with "Ada@Example.com" can still sign in.

If two accounts differ only by case, lowercasing would violate the unique
constraint on users.email. The migration refuses to guess which account to
keep: it lists the clashes and stops, so they can be merged or renamed first.

Revision ID: a7b8c9d0e1f2
Revises: f6a7b8c9d0e1

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a7b8c9d0e1f2"
down_revision: Union[str, Sequence[str], None] = "f6a7b8c9d0e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    connection = op.get_bind()
    clashes = connection.execute(sa.text(
        "SELECT lower(trim(email)) AS normalised, string_agg(email, ', ' ORDER BY id) AS emails "
        "FROM users GROUP BY lower(trim(email)) HAVING count(*) > 1"
    )).fetchall()
    if clashes:
        listing = "; ".join(f"{row.normalised}: {row.emails}" for row in clashes)
        raise RuntimeError(
            "Cannot lowercase users.email: these accounts differ only by case "
            f"or surrounding whitespace. Resolve them first. {listing}"
        )

    connection.execute(sa.text(
        "UPDATE users SET email = lower(trim(email)) WHERE email <> lower(trim(email))"
    ))


def downgrade() -> None:
    """Downgrade schema.

    No-op: the original casing is not recorded, and lowercase addresses are
    valid under the previous code too.
    """
