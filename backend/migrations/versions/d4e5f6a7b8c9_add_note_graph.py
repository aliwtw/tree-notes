"""add note graph and rich-text columns

Stores each note's Cytoscape graph on the note row itself, so the graph a user
arranges in GraphPanel survives a refresh, a re-login, or reopening the note.

graph_json holds the whole graph:

    {
      "nodes": [{"data": {"id": "1", "label": "React", ...},
                 "position": {"x": 250.0, "y": 160.0}}],
      "edges": [{"data": {"id": "e1", "source": "1", "target": "2"}}]
    }

JSONB rather than graph_nodes/graph_edges tables because each element carries
open-ended keys the panel round-trips (color, shape, linkColor, importance,
weight) that a fixed column set would drop.

Revision ID: d4e5f6a7b8c9
Revises: ffa13c790c4e

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, Sequence[str], None] = "ffa13c790c4e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Both nullable: every existing note predates them, and a note is perfectly
    # valid with no graph and no rich text.
    op.add_column(
        "notes",
        sa.Column("graph_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    # The rich-text body. Raw Notes wraps graph-linked text in spans carrying the
    # Cytoscape node id, so those links are lost on reload without the markup,
    # even once graph_json is stored.
    op.add_column("notes", sa.Column("notes_section_html", sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("notes", "notes_section_html")
    op.drop_column("notes", "graph_json")
