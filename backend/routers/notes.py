from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.dependencies import get_current_user
from backend.models import Group, Note, User
from backend.schemas import CytoscapeGraph, NoteCreate, NoteResponse, NoteUpdate, SemanticSearchRequest
from backend.ai.ai import ai_search_graph

router = APIRouter()


def _get_owned_note(note_id: int, db: Session, user: User) -> Note:
    """Fetch a note, scoped to its owner.

    Filtering on user_id rather than checking ownership afterwards means another
    user's note is a 404, not a 403: the response cannot be used to probe which
    note ids exist.
    """
    note = (
        db.query(Note)
        .filter(Note.id == note_id, Note.user_id == user.id)
        .first()
    )
    if not note:
        raise HTTPException(
            status_code = status.HTTP_404_NOT_FOUND,
            detail = f"Note id of {note_id} not found",
        )
    return note


def _require_owned_group(group_id: Optional[int], db: Session, user: User) -> None:
    """A note may only be filed in one of its owner's groups.

    Checked up front because the foreign key alone would accept another user's
    group, and turns a nonexistent one into an IntegrityError and a 500. None
    means "not filed anywhere" and is always allowed. Same 404-not-403
    reasoning as _get_owned_note.
    """
    if group_id is None:
        return
    exists = (
        db.query(Group.id)
        .filter(Group.id == group_id, Group.user_id == user.id)
        .first()
    )
    if not exists:
        raise HTTPException(
            status_code = status.HTTP_404_NOT_FOUND,
            detail = f"Group {group_id} not found",
        )


def _graph_for_client(graph_json: Any) -> Dict[str, List[Any]]:
    """The stored graph as the panel expects it: always both lists.

    Rows are returned as stored rather than validated, so a row written before
    validation existed, or edited by hand, still reaches the panel instead of
    failing the read. The only rewrite drops the "position": null that earlier
    writes stored on edges.
    """
    graph = graph_json if isinstance(graph_json, dict) else {}

    def elements(key: str) -> List[Any]:
        items = graph.get(key)
        if not isinstance(items, list):
            return []
        return [
            {k: v for k, v in item.items() if not (k == "position" and v is None)}
            if isinstance(item, dict) else item
            for item in items
        ]

    return {"nodes": elements("nodes"), "edges": elements("edges")}


@router.post(
    "",
    response_model=NoteResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_note(
        payload: NoteCreate,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
) -> Note:
    _require_owned_group(payload.group_id, db, current_user)

    fields = payload.model_dump()
    content = fields.pop("content", None)
    if content is not None and fields.get("notes_section") is None:
        fields["notes_section"] = content
    if payload.graph_json is not None:
        fields["graph_json"] = payload.graph_json.to_storage()

    note = Note(**fields, user_id = current_user.id)
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.get("", response_model=List[NoteResponse])
def list_notes(
        skip: int = 0,
        limit: int = 100,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
) -> List[Note]:
    return (
        db.query(Note)
        .filter(Note.user_id == current_user.id)
        .order_by(Note.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def normalise_search_result(concept_id: int, graph: dict, score: float):
    # find the node in graph.nodes with id == concept_id
    for node in graph["nodes"]:
        if str(node["id"]) == str(concept_id):
            return {
                "node_id": node["id"],
                "label": node["label"],
                "score": score
            }
    return None # if no nodes match

@router.post("/{note_id}/graph/search")
def semantic_search(
    note_id: str, # <--- SHOULD THIS BE A STRING OR AN INTEGER? IT ONLY WORKS WHEN IT IS A STRING <!!!>
    payload: SemanticSearchRequest,
    current_user: User = Depends(get_current_user)
    ):

    query = payload.query
    graph_dict = payload.graph.dict()

    try:
        return { "match": ai_search_graph(query, graph_dict) }
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Semantic search failed: {exc}")

@router.get("/{note_id}", response_model=NoteResponse)
def read_note(
        note_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
) -> Note:
    return _get_owned_note(note_id, db, current_user)


@router.patch("/{note_id}", response_model=NoteResponse)
def update_note(
        note_id: int,
        payload: NoteUpdate,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
) -> Note:
    note = _get_owned_note(note_id, db, current_user)
    # exclude_unset so a save that sends only the body does not blank the graph,
    # and a graph-only save does not blank the body.
    changes = payload.model_dump(exclude_unset = True)
    # content is an alias, not a column. Redirect it before the setattr loop,
    # which would otherwise hang a stray attribute off the ORM object that
    # never reaches the database.
    content = changes.pop("content", None)
    if content is not None and "notes_section" not in changes:
        changes["notes_section"] = content

    if "group_id" in changes:
        _require_owned_group(changes["group_id"], db, current_user)

    # An explicit null clears the saved graph; anything else is stored in the
    # same shape PUT /graph stores.
    if payload.graph_json is not None:
        changes["graph_json"] = payload.graph_json.to_storage()

    for field, value in changes.items():
        setattr(note, field, value)

    note.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(note)
    return note


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(
        note_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
) -> None:
    note = _get_owned_note(note_id, db, current_user)
    # graph_json is a column on this row, so the note's graph goes with it. No
    # separate cleanup to forget.
    db.delete(note)
    db.commit()


# Both graph routes return a JSONResponse built from the stored dict. Returning
# it through response_model would re-validate a pre-validation row into a 500,
# emit Pydantic serializer warnings on every read, and add "position": null to
# every edge. response_model stays on the decorators for the OpenAPI docs.

@router.get("/{note_id}/graph", response_model=CytoscapeGraph)
def read_note_graph(
        note_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
) -> JSONResponse:
    """The saved Cytoscape graph for a note.

    A note that has never had a graph saved returns empty node and edge lists
    rather than 404, so the panel can load unconditionally on open and simply
    render nothing when there is nothing to render.
    """
    note = _get_owned_note(note_id, db, current_user)
    return JSONResponse(_graph_for_client(note.graph_json))


@router.put("/{note_id}/graph", response_model=CytoscapeGraph)
def replace_note_graph(
        note_id: int,
        payload: CytoscapeGraph,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
) -> JSONResponse:
    """Replace a note's graph outright.

    PUT rather than PATCH because the panel always sends the whole graph: a
    merge would resurrect nodes and edges the user has just deleted.
    """
    note = _get_owned_note(note_id, db, current_user)

    note.graph_json = payload.to_storage()
    note.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(note)
    return JSONResponse(_graph_for_client(note.graph_json))
