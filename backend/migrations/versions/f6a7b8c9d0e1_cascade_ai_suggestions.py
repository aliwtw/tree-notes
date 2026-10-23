"""cascade ai_suggestions when a note is deleted

Both ai_suggestions foreign keys to notes had no ON DELETE action, so deleting
any note that a suggestion referenced (from either side) failed with an
IntegrityError and a 500. note_links got the same fix in c3d4e5f6a7b8.

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f6a7b8c9d0e1"
down_revision: Union[str, Sequence[str], None] = "e5f6a7b8c9d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

FOREIGN_KEYS = (
    ("ai_suggestions_note_id_fkey", "note_id"),
    ("ai_suggestions_suggested_note_id_fkey", "suggested_note_id"),
)


def upgrade() -> None:
    """Upgrade schema."""
    for name, column in FOREIGN_KEYS:
        op.drop_constraint(name, "ai_suggestions", type_="foreignkey")
        op.create_foreign_key(name, "ai_suggestions", "notes", [column], ["id"], ondelete="CASCADE")


def downgrade() -> None:
    """Downgrade schema."""
    for name, column in FOREIGN_KEYS:
        op.drop_constraint(name, "ai_suggestions", type_="foreignkey")
        op.create_foreign_key(name, "ai_suggestions", "notes", [column], ["id"])
