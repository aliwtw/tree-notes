from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.dependencies import get_current_user
from backend.models import Group, Note, NoteLink, User
from backend.schemas import (
    GraphResponse,
    GroupCreate,
    GroupResponse,
    LinkCreate,
    LinkResponse,
)

router = APIRouter()


@router.post("", response_model=GroupResponse, status_code=status.HTTP_201_CREATED)
def create_group(
        payload: GroupCreate,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
) -> Group:
    name = payload.name.strip()
    if not name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Group name cannot be empty",
        )

    existing = (
        db.query(Group)
        .filter(Group.user_id == current_user.id, Group.name == name)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A group named '{name}' already exists",
        )

    if payload.parent_id is not None:
        parent = _get_group(db, payload.parent_id, current_user.id)
        if parent is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Parent group {payload.parent_id} not found",
            )

    group = Group(name=name, parent_id=payload.parent_id, user_id=current_user.id)
    db.add(group)
    db.commit()
    db.refresh(group)
    return group


@router.get("", response_model=List[GroupResponse])
def list_groups(
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
) -> List[Group]:
    return (
        db.query(Group)
        .filter(Group.user_id == current_user.id)
        .order_by(Group.name)
        .all()
    )


@router.get("/graph", response_model=GraphResponse)
def read_graph(
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
) -> GraphResponse:

    groups = (
        db.query(Group)
        .filter(Group.user_id == current_user.id)
        .order_by(Group.name)
        .all()
    )
    notes = (
        db.query(Note)
        .filter(Note.user_id == current_user.id)
        .order_by(Note.title)
        .all()
    )

    note_ids = {note.id for note in notes}
    links = [
        link
        for link in db.query(NoteLink).all()
        if link.note_a_id in note_ids and link.note_b_id in note_ids
    ]

    return GraphResponse(groups=groups, notes=notes, links=links)


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_group(
        group_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
) -> None:
    group = _get_group(db, group_id, current_user.id)
    if group is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Group {group_id} not found",
        )


    held = _descendant_ids(db, group_id, current_user.id)
    note_count = (
        db.query(Note)
        .filter(Note.user_id == current_user.id, Note.group_id.in_(held))
        .count()
    )
    if note_count:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Group still holds {note_count} note(s). "
                "Move or delete them before deleting the group."
            ),
        )

    db.delete(group)
    db.commit()


@router.post("/links", response_model=LinkResponse, status_code=status.HTTP_201_CREATED)
def create_link(
        payload: LinkCreate,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
) -> NoteLink:
    if payload.note_a_id == payload.note_b_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A note cannot be linked to itself",
        )

    note_a = _get_note(db, payload.note_a_id, current_user.id)
    note_b = _get_note(db, payload.note_b_id, current_user.id)
    if note_a is None or note_b is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Both notes must exist",
        )

    if note_a.group_id is None or note_a.group_id != note_b.group_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Notes can only be linked within the same group",
        )


    low, high = sorted((payload.note_a_id, payload.note_b_id))

    existing = (
        db.query(NoteLink)
        .filter(NoteLink.note_a_id == low, NoteLink.note_b_id == high)
        .first()
    )
    if existing:
        return existing

    link = NoteLink(note_a_id=low, note_b_id=high, label=payload.label)
    db.add(link)
    db.commit()
    db.refresh(link)
    return link


@router.delete("/links/{link_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_link(
        link_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
) -> None:
    link = db.query(NoteLink).filter(NoteLink.id == link_id).first()
    if link is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Link {link_id} not found",
        )

    # A link is only reachable by the user who owns both of its endpoints.
    if _get_note(db, link.note_a_id, current_user.id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Link {link_id} not found",
        )

    db.delete(link)
    db.commit()


def _get_group(db: Session, group_id: int, user_id: int) -> Group | None:
    return (
        db.query(Group)
        .filter(Group.id == group_id, Group.user_id == user_id)
        .first()
    )


def _get_note(db: Session, note_id: int, user_id: int) -> Note | None:
    return (
        db.query(Note)
        .filter(Note.id == note_id, Note.user_id == user_id)
        .first()
    )


def _descendant_ids(db: Session, group_id: int, user_id: int) -> List[int]:
#Find children ids
    groups = db.query(Group).filter(Group.user_id == user_id).all()
    children: dict[int, List[int]] = {}
    for group in groups:
        children.setdefault(group.parent_id, []).append(group.id)

    found = [group_id]
    queue = [group_id]
    while queue:
        current = queue.pop()
        for child in children.get(current, []):
            found.append(child)
            queue.append(child)
    return found
