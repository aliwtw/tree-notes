from sqlalchemy import (
    Column, Integer, String, Text, Boolean, 
    Float, ForeignKey, TIMESTAMP, CheckConstraint,
    UniqueConstraint
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import TIMESTAMP as PG_TIMESTAMP
from sqlalchemy.orm import declarative_base
from sqlalchemy.sql import func

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    username = Column(String(255), nullable=False, unique=True)
    email = Column(String(255), nullable=False, unique=True)
    password_hash = Column(String(255), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    # Profile fields. All nullable: existing rows predate them, and the profile
    # page treats every one as optional. memberSince is derived from created_at
    # rather than stored.
    full_name = Column(String(255), nullable=True)
    display_name = Column(String(255), nullable=True)
    bio = Column(Text, nullable=True)
    profile_image_url = Column(String(512), nullable=True)
    created_at = Column(PG_TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(PG_TIMESTAMP(timezone=True), nullable=False, server_default=func.now())


class Group(Base):
    """A named container for notes. Groups nest via parent_id, so "biology" can
    hold "mitosis" and "meiosis", each holding notes of their own."""

    __tablename__ = "groups"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(255), nullable=False)
    parent_id = Column(Integer, ForeignKey("groups.id", ondelete="CASCADE"), nullable=True)
    created_at = Column(PG_TIMESTAMP(timezone=True), nullable=False, server_default=func.now())

    # Unique per user, not globally: two users can each have a "biology" group.
    # Matches the duplicate check in routers/groups.py.
    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_groups_user_id_name"),
    )


class Note(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    # Nullable: notes created before groups existed, and notes the user has not
    # filed anywhere, have no group.
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=True)
    title = Column(String(255), nullable=False)
    cue_section = Column(Text, nullable=True)
    notes_section = Column(Text, nullable=True)
    # The rich-text version of notes_section. Raw Notes wraps graph-linked text
    # in spans carrying the Cytoscape node id, so without the markup those links
    # are lost even when graph_json survives.
    notes_section_html = Column(Text, nullable=True)
    summary_section = Column(Text, nullable=True)
    # The note's Cytoscape graph, stored whole as
    # {"nodes": [{"data": {...}, "position": {...}}], "edges": [{"data": {...}}]}
    # exactly as GraphPanel.getEditedGraphData() emits it. JSONB rather than
    # node/edge tables because each element carries open-ended keys the panel
    # round-trips (color, shape, linkColor, importance, weight) that a fixed
    # column set would silently drop. Null until the note's graph is first saved.
    graph_json = Column(JSONB, nullable=True)
    is_node = Column(Boolean, nullable=False, default=False)
    created_at = Column(PG_TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(PG_TIMESTAMP(timezone=True), nullable=False, server_default=func.now())


class NoteLink(Base):
    __tablename__ = "note_links"

    id = Column(Integer, primary_key=True)
    # CASCADE so deleting a note does not leave dangling links behind, which
    # would otherwise fail the delete with an IntegrityError.
    note_a_id = Column(Integer, ForeignKey("notes.id", ondelete="CASCADE"), nullable=False)
    note_b_id = Column(Integer, ForeignKey("notes.id", ondelete="CASCADE"), nullable=False)
    relationship_type = Column(String(100), nullable=True)
    strength = Column(Float, nullable=True)
    label = Column(String(255), nullable=True)
    ai_generated = Column(Boolean, nullable=False, default=False)
    created_at = Column(PG_TIMESTAMP(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("note_a_id", "note_b_id", name="uq_note_links_pair"),
        CheckConstraint("strength >= 0.0 AND strength <= 1.0", name="ck_note_links_strength"),
    )


class AISuggestion(Base):
    __tablename__ = "ai_suggestions"

    id = Column(Integer, primary_key=True)
    # CASCADE for the same reason as NoteLink: a suggestion is meaningless once
    # either note is gone, and without it deleting the note fails.
    note_id = Column(Integer, ForeignKey("notes.id", ondelete="CASCADE"), nullable=False)
    suggested_note_id = Column(Integer, ForeignKey("notes.id", ondelete="CASCADE"), nullable=False)
    reasoning = Column(Text, nullable=True)
    confidence_score = Column(Float, nullable=True)
    status = Column(String(20), nullable=False, default="pending")
    created_at = Column(PG_TIMESTAMP(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        CheckConstraint("confidence_score >= 0.0 AND confidence_score <= 1.0", name="ck_ai_suggestions_confidence"),
        CheckConstraint("status IN ('pending', 'approved', 'rejected')", name="ck_ai_suggestions_status"),
    )