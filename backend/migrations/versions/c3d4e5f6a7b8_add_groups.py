

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "groups",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("parent_id", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),

        sa.ForeignKeyConstraint(["parent_id"], ["groups.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="uq_groups_name"),
    )

    op.add_column("notes", sa.Column("group_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_notes_group_id", "notes", "groups", ["group_id"], ["id"]
    )

#dropping constraints
    op.drop_constraint("note_links_note_a_id_fkey", "note_links", type_="foreignkey")
    op.drop_constraint("note_links_note_b_id_fkey", "note_links", type_="foreignkey")
    op.create_foreign_key(
        "note_links_note_a_id_fkey",
        "note_links",
        "notes",
        ["note_a_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "note_links_note_b_id_fkey",
        "note_links",
        "notes",
        ["note_b_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint("note_links_note_a_id_fkey", "note_links", type_="foreignkey")
    op.drop_constraint("note_links_note_b_id_fkey", "note_links", type_="foreignkey")
    op.create_foreign_key(
        "note_links_note_a_id_fkey", "note_links", "notes", ["note_a_id"], ["id"]
    )
    op.create_foreign_key(
        "note_links_note_b_id_fkey", "note_links", "notes", ["note_b_id"], ["id"]
    )

    op.drop_constraint("fk_notes_group_id", "notes", type_="foreignkey")
    op.drop_column("notes", "group_id")
    op.drop_table("groups")
