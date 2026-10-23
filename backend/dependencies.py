from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import User


def get_current_user(
        request: Request,
        db: Session = Depends(get_db),
) -> User:
    """Resolve the signed session cookie to the User row it identifies.

    Replaces the DEV_USER_ID constant the routers previously hardcoded, so
    every query is scoped to whoever is actually logged in.
    """
    user_id = request.session.get("user_id")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    user = (
        db.query(User)
        .filter(User.id == user_id, User.is_active.is_(True))
        .first()
    )
    if user is None:
        # The cookie is validly signed but points at a user who has since
        # been deleted or deactivated. Clear it so the client stops
        # resending a session that can never resolve.
        request.session.clear()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    return user
