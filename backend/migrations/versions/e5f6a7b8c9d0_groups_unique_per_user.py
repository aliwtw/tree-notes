"""make group names unique per user

groups.name was UNIQUE across every user, while routers/groups.py only checks
for a duplicate within the current user's groups. A second user creating a
group name someone else already had passed that check and then failed the
constraint with a 500.

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, Sequence[str], None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_constraint("uq_groups_name", "groups", type_="unique")
    op.create_unique_constraint("uq_groups_user_id_name", "groups", ["user_id", "name"])


def downgrade() -> None:
    """Downgrade schema.

    Fails if two users now share a group name. Rename one of them first.
    """
    op.drop_constraint("uq_groups_user_id_name", "groups", type_="unique")
    op.create_unique_constraint("uq_groups_name", "groups", ["name"])
