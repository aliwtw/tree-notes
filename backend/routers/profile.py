from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.dependencies import get_current_user
from backend.models import User
from backend.schemas import (
    NavbarResponse,
    PasswordChangeRequest,
    ProfileResponse,
    ProfileUpdate,
    ProfileUpdateResponse,
)
from backend.security import (
    MAX_PASSWORD_BYTES, MIN_PASSWORD_LENGTH, normalise_email, password_too_long, pwd_context,
)

router = APIRouter()


def _display_name(user: User) -> str:
    return user.display_name or user.full_name or user.username


def _initials(name: str) -> str:
    parts = [part for part in name.split() if part]
    if not parts:
        return "?"
    if len(parts) == 1:
        return parts[0][:2].upper()
    return (parts[0][0] + parts[-1][0]).upper()


def _profile(user: User) -> ProfileResponse:
    return ProfileResponse(
        fullName=user.full_name or user.username,
        displayName=_display_name(user),
        email=user.email,
        bio=user.bio or "",
        memberSince=str(user.created_at.year),
    )


@router.get("/profile", response_model=ProfileResponse)
def read_profile(
        current_user: User = Depends(get_current_user),
) -> ProfileResponse:
    return _profile(current_user)


@router.put("/profile", response_model=ProfileUpdateResponse)
def update_profile(
        payload: ProfileUpdate,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
):
    changes = payload.model_dump(exclude_unset=True)

    # Lowercased like register and login, or a profile edit could store a
    # mixed-case address that login would then never match.
    new_email = normalise_email(changes["email"]) if changes.get("email") else None
    if new_email and new_email != current_user.email:
        taken = (
            db.query(User)
            .filter(User.email == new_email, User.id != current_user.id)
            .first()
        )
        if taken:
            # Caught here rather than left to the unique constraint, which
            # would surface as an IntegrityError and a 500.
            return JSONResponse(
                status_code=status.HTTP_409_CONFLICT,
                content={
                    "success": False,
                    "message": "That email address is already in use.",
                },
            )
        current_user.email = new_email

    if "fullName" in changes:
        current_user.full_name = changes["fullName"]
    if "displayName" in changes:
        current_user.display_name = changes["displayName"]
    if "bio" in changes:
        current_user.bio = changes["bio"]

    db.commit()
    db.refresh(current_user)

    return ProfileUpdateResponse(success=True, profile=_profile(current_user))


@router.put("/profile/password")
def change_password(
        payload: PasswordChangeRequest,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
) -> JSONResponse:
    # Every branch returns a body carrying "message". FastAPI's HTTPException
    # would emit {"detail": ...}, which the modal reads as undefined and
    # replaces with generic text.
    if not pwd_context.verify(payload.oldPassword, current_user.password_hash):
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"message": "Your current password is incorrect."},
        )

    if len(payload.newPassword) < MIN_PASSWORD_LENGTH:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "message": (
                    f"Your new password must be at least "
                    f"{MIN_PASSWORD_LENGTH} characters long."
                )
            },
        )

    if password_too_long(payload.newPassword):
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "message": (
                    f"Your new password must be at most "
                    f"{MAX_PASSWORD_BYTES} bytes long."
                )
            },
        )

    if payload.oldPassword == payload.newPassword:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "message": (
                    "Your new password must be different from your "
                    "current password."
                )
            },
        )

    current_user.password_hash = pwd_context.hash(payload.newPassword)
    db.commit()

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={"message": "Password updated successfully."},
    )


@router.get("/user/navbar", response_model=NavbarResponse)
def read_navbar(
        current_user: User = Depends(get_current_user),
) -> NavbarResponse:
    name = _display_name(current_user)
    return NavbarResponse(
        displayName=name,
        initials=_initials(name),
        profileImage=current_user.profile_image_url,
    )
