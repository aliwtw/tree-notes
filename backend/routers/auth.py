import re

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import User
from backend.schemas import (
    USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH,
    LoginRequest, LoginResponse, UserPublic, UserRegister,
)
from backend.security import pwd_context

router = APIRouter()


def _start_session(request: Request, user: User) -> None:
    # Establishes the signed, HttpOnly session cookie. The frontend sends
    # credentials: "include" and never stores a token anywhere, so a cookie
    # is the only mechanism its existing code can actually use.
    request.session["user_id"] = user.id


def _username_from_email(db: Session, email: str) -> str:
    """A free username derived from the email's local part.

    RegisterCard.jsx collects no username, but users.username is NOT NULL and
    unique. "ada.lovelace@x.com" becomes "ada.lovelace", then "ada.lovelace2",
    "ada.lovelace3", ... until one is free.
    """
    base = re.sub(r"[^a-z0-9._-]", "", email.split("@", 1)[0].lower())
    if len(base) < USERNAME_MIN_LENGTH:
        base = f"{base}user"
    # Leaves room for a numeric suffix without breaking the length limit.
    base = base[:USERNAME_MAX_LENGTH - 6]

    candidate = base
    suffix = 1
    while db.query(User.id).filter(User.username == candidate).first():
        suffix += 1
        candidate = f"{base}{suffix}"
    return candidate


@router.post("/login", response_model=LoginResponse)
def login(
        payload: LoginRequest,
        request: Request,
        db: Session = Depends(get_db),
) -> LoginResponse:
    # payload.email is already lowercased, and emails are stored lowercased.
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not pwd_context.verify(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # Checked after the password, so only someone who knows the password learns
    # the account exists but is disabled. Without this check the login
    # succeeded and every following request 401'd in get_current_user.
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated",
        )

    _start_session(request, user)

    return LoginResponse(
        user=UserPublic(id=user.id, email=user.email, name=user.username)
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request) -> None:
    # Deliberately unauthenticated: logging out while already logged out
    # should succeed quietly rather than 401.
    request.session.clear()


@router.post("/register", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
def register(
        payload: UserRegister,
        request: Request,
        db: Session = Depends(get_db),
) -> UserPublic:
    """
    Register a new user and log them in.

    Accepts the RegisterCard.jsx payload {fullName, email, password}; username
    is optional and derived from the email when omitted. The response carries
    the session cookie, so the frontend can go straight to the dashboard.
    """
    # payload.email is already lowercased, so this also catches the same
    # address in a different case.
    existing_email = db.query(User).filter(User.email == payload.email).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered"
        )

    if payload.username is not None:
        existing_username = db.query(User).filter(User.username == payload.username).first()
        if existing_username:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username already taken"
            )
        username = payload.username
    else:
        username = _username_from_email(db, payload.email)

    new_user = User(
        username=username,
        email=payload.email,
        full_name=payload.fullName,
        password_hash=pwd_context.hash(payload.password),
        is_active=True
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    _start_session(request, new_user)

    return UserPublic(id = new_user.id, email = new_user.email, name = new_user.username)
