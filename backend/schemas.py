from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import (
    BaseModel, ConfigDict, computed_field, EmailStr, Field,
    field_validator, model_validator,
)

from backend.security import (
    MAX_PASSWORD_BYTES, MIN_PASSWORD_LENGTH, normalise_email, password_too_long,
)

# notes.title is VARCHAR(255). Enforced here so an over-long title is a 422
# rather than a DataError surfacing as a 500.
NOTE_TITLE_MAX_LENGTH = 255


class GraphPosition(BaseModel):
    """Where Cytoscape laid a node out on the canvas. Persisted so a reopened
    note shows the graph the user arranged, not a fresh cose layout."""
    x: float
    y: float


class GraphElement(BaseModel):
    # Cytoscape elements carry more than TreeNotes reads today (classes, group,
    # locked, selected). extra="allow" keeps whatever the panel sent, so a
    # round-trip through the database does not quietly strip it.
    model_config = ConfigDict(extra="allow")

    # Required rather than defaulted: every element GraphPanel builds has a data
    # object with at least an id, and an element without one cannot be rendered.
    # Rejecting it here beats storing an element the graph can never draw.
    # CytoscapeGraph checks the id itself, since that needs the whole graph.
    data: Dict[str, Any]
    # Edges have no position, so this stays None for them.
    position: Optional[GraphPosition] = None

    def to_storage(self) -> Dict[str, Any]:
        stored = self.model_dump()
        # Dropped rather than stored as null, so an edge reads back exactly as
        # the panel sent it.
        if stored.get("position") is None:
            stored.pop("position", None)
        return stored


def _element_ref(data: Dict[str, Any], key: str) -> Optional[str]:
    """An element id (or edge endpoint) as Cytoscape compares it: a non-empty
    string, with numbers coerced the way Cytoscape coerces them."""
    value = data.get(key)
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return str(value)
    if isinstance(value, str) and value.strip():
        return value
    return None


class CytoscapeGraph(BaseModel):
    """The shape GraphPanel.getEditedGraphData() produces and the graph routes
    return. Both lists default to empty so a note whose graph has never been
    saved reads back as an empty graph rather than null."""
    nodes: List[GraphElement] = Field(default_factory=list)
    edges: List[GraphElement] = Field(default_factory=list)

    @model_validator(mode="after")
    def check_renderable(self) -> "CytoscapeGraph":
        """Reject anything cytoscape() throws on when the saved graph is
        reloaded: a missing or duplicated id, or an edge whose endpoint is not
        a node in this graph. Stored, any of these would break the note's
        graph panel on every open."""
        seen_ids = set()
        node_ids = set()
        for group, elements in (("nodes", self.nodes), ("edges", self.edges)):
            for index, element in enumerate(elements):
                element_id = _element_ref(element.data, "id")
                if element_id is None:
                    raise ValueError(f"{group}[{index}].data.id is required")
                if element_id in seen_ids:
                    raise ValueError(f"{group}[{index}].data.id '{element_id}' is used by more than one element")
                seen_ids.add(element_id)
                if group == "nodes":
                    node_ids.add(element_id)

        for index, edge in enumerate(self.edges):
            for endpoint in ("source", "target"):
                ref = _element_ref(edge.data, endpoint)
                if ref is None:
                    raise ValueError(f"edges[{index}].data.{endpoint} is required")
                if ref not in node_ids:
                    raise ValueError(f"edges[{index}].data.{endpoint} '{ref}' does not match any node id")
        return self

    def to_storage(self) -> Dict[str, List[Dict[str, Any]]]:
        """The JSONB value for notes.graph_json. Every write path goes through
        here so the stored shape does not depend on which route saved it."""
        return {
            "nodes": [element.to_storage() for element in self.nodes],
            "edges": [element.to_storage() for element in self.edges],
        }


class NoteBase(BaseModel):
    title: str
    cue_section: Optional[str] = None
    notes_section: Optional[str] = None
    notes_section_html: Optional[str] = None
    summary_section: Optional[str] = None
    is_node: bool = False
    group_id: Optional[int] = None


# content is declared on the write models rather than on NoteBase, because
# NoteResponse already exposes content as a computed field and the two would
# collide. It is a write-side alias for notes_section so the frontend can use
# one field name in both directions; an explicit notes_section takes priority.
class NoteCreate(NoteBase):
    title: str = Field(..., max_length = NOTE_TITLE_MAX_LENGTH)
    content: Optional[str] = None
    graph_json: Optional[CytoscapeGraph] = None

class NoteUpdate(NoteBase):
    title: Optional[str] = Field(None, max_length = NOTE_TITLE_MAX_LENGTH)
    cue_section: Optional[str] = None
    notes_section: Optional[str] = None
    notes_section_html: Optional[str] = None
    summary_section: Optional[str] = None
    is_node: bool = False
    content: Optional[str] = None
    # Validated on the way in so a malformed graph is rejected at the edge
    # rather than stored and blown up on read. Omit the field to leave the
    # saved graph untouched; PATCH only writes what was actually sent.
    graph_json: Optional[CytoscapeGraph] = None

    # Optional so a PATCH can leave the title out, but notes.title is NOT NULL:
    # an explicit null has to be a 422 here, not an IntegrityError on commit.
    # Field validators do not run on defaults, so omitting the key still works.
    @field_validator("title")
    @classmethod
    def title_not_null(cls, value: Optional[str]) -> str:
        if value is None:
            raise ValueError("title cannot be null; omit it to leave the title unchanged")
        return value

class NoteResponse(NoteBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    # Deliberately untyped on the way out. Rows written before this column
    # existed, or by hand, must not be able to fail the response validation and
    # take the whole note read down with them.
    graph_json: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    @property
    def content(self) -> str:
        """NoteWorkspace.jsx reads note.content as one body string, while the
        model splits the note into cue/notes/summary sections. Empty string
        rather than null so the editor can bind to it directly."""
        return self.notes_section or ""


class GroupCreate(BaseModel):
    name: str
    parent_id: Optional[int] = None


class GroupResponse(BaseModel):
    id: int
    name: str
    parent_id: Optional[int] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class NoteSummary(BaseModel):
    id: int
    title: str
    group_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class LinkCreate(BaseModel):
    note_a_id: int
    note_b_id: int
    label: Optional[str] = None


class LinkResponse(BaseModel):
    id: int
    note_a_id: int
    note_b_id: int
    label: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class SearchNode(BaseModel):
    id: str
    importance: float = None
    label: str = None
    type: str = None
    category: str = None


class SearchEdge(BaseModel):
    id: str
    label: str = None
    source: str
    target: str
    weight: float = None
    type: str = None


class SearchGraph(BaseModel):
    nodes: List[SearchNode]
    edges: List[SearchEdge]


class SemanticSearchRequest(BaseModel):
    query: str
    graph: SearchGraph


class GraphResponse(BaseModel):
    groups: List[GroupResponse]
    notes: List[NoteSummary]
    links: List[LinkResponse]


class LoginRequest(BaseModel):
    # Plain str, not EmailStr: login only looks the address up, and an account
    # whose email predates validation must still be able to sign in.
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def normalise(cls, value: str) -> str:
        return normalise_email(value)


class UserPublic(BaseModel):
    id: int
    email: str
    # The frontend reads this as "name"; the column is called username.
    name: str


class LoginResponse(BaseModel):
    # Nested under "user" because that is the shape Login.jsx documents.
    user: UserPublic


class ProfileResponse(BaseModel):
    fullName: str
    displayName: str
    email: str
    # Never null: ProfileContent.jsx calls profile.bio.length without a guard
    # and would crash the render.
    bio: str
    memberSince: str


class ProfileUpdate(BaseModel):
    fullName: Optional[str] = None
    displayName: Optional[str] = None
    email: Optional[str] = None
    bio: Optional[str] = None


class ProfileUpdateResponse(BaseModel):
    # The component gates on result?.success rather than the status code, so a
    # bare updated profile would read as a failure even on a 200.
    success: bool
    profile: ProfileResponse


class PasswordChangeRequest(BaseModel):
    oldPassword: str
    newPassword: str


class NavbarResponse(BaseModel):
    displayName: str
    initials: str
    profileImage: Optional[str] = None


class RawNotesRequest(BaseModel):
    rawNotes: str
    # The AI functions accept these too, but GraphPanel and SummaryPanel send
    # only rawNotes today. Defaulted so the panels work now, and so the My
    # Summary tab can start sending userSummary without a backend change.
    graphJson: SearchGraph = None
    userSummary: str = ""


class SummaryResponse(BaseModel):
    # Both fields carry the same text. SummaryPanel originally read
    # data.summary and now reads data.aiSummary, so returning both means
    # either works and neither side has to coordinate a rename.
    summary: str
    aiSummary: str
    userSummaryReview: str = ""
    userScore: int = 0


USERNAME_MIN_LENGTH = 3
USERNAME_MAX_LENGTH = 50


class UserRegister(BaseModel):
    # Optional because RegisterCard.jsx collects no username. When omitted, the
    # register route derives one from the email address.
    username: Optional[str] = Field(
        None, min_length = USERNAME_MIN_LENGTH, max_length = USERNAME_MAX_LENGTH, description = "username",
    )
    # What RegisterCard.jsx sends. Optional there, stored as users.full_name.
    fullName: Optional[str] = Field(None, max_length = 255, description = "full name")
    email: EmailStr = Field(..., description = "emailAddress")
    password: str = Field(..., min_length = MIN_PASSWORD_LENGTH, description = "password")

    @field_validator("username", "fullName", mode = "before")
    @classmethod
    def blank_to_none(cls, value: Any) -> Any:
        # RegisterCard sends fullName: "" when the field is left empty.
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value

    @field_validator("email")
    @classmethod
    def normalise(cls, value: str) -> str:
        return normalise_email(value)

    @field_validator("password")
    @classmethod
    def fits_bcrypt(cls, value: str) -> str:
        if password_too_long(value):
            raise ValueError(f"Password must be at most {MAX_PASSWORD_BYTES} bytes")
        return value
