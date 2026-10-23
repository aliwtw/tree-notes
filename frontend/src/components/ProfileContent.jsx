import { useEffect, useRef, useState, } from "react";
import "./ProfileContent.css";
import usePageTitle from "../hooks/usePageTitle";
import { 
  X,
  ChevronDown,
  Check,
} from "lucide-react";
import { useTheme } from "../context/ThemeContext.jsx";

import {
  USE_MOCK_API,
} from "../config/apiConfig";

// Initial state for the profile data. This is used to reset the form when the component is first loaded or when the user logs out.
const initialProfile = {
  fullName: "",
  displayName: "",
  email: "",
  bio: "",
  memberSince: "",
};

const mockProfile = {
  fullName: "Development User",
  displayName: "devuser",
  email: "dev@treenotes.local",
  bio: "Building connected notes and turning scattered ideas into useful knowledge.",
  memberSince: "2026",
};

// Stores the initial state of the password change form. This is used to reset the form when the modal is closed.
const emptyPasswordForm = {
  oldPassword: "",
  newPassword: "",
  confirmPassword: "",
};

// Backend
// Function for retrieving user details
// Backend / mock
// Function for retrieving user details
async function getLoggedInUserDetails() {

  /*
    Frontend-only development mode.
  */
  if (USE_MOCK_API) {
    return {
      ...mockProfile,
    };
  }


  /*
    Real backend mode.
  */
  const response =
    await fetch(
      "/api/profile",
      {
        method: "GET",
        credentials: "include",
      }
    );


  if (!response.ok) {
    throw new Error(
      "Unable to retrieve user profile."
    );
  }


  return await response.json();
}

// Backend / mock
// Function for saving updated user details
async function saveLoggedInUserDetails(
  profileData
) {

  /*
    Frontend-only development mode.
  */
  if (USE_MOCK_API) {
    return {
      success: true,
      profile: {
        ...profileData,
      },
    };
  }


  /*
    Real backend mode.
  */
  const response =
    await fetch(
      "/api/profile",
      {
        method: "PUT",

        headers: {
          "Content-Type":
            "application/json",
        },

        credentials:
          "include",

        body:
          JSON.stringify(
            profileData
          ),
      }
    );


  const result =
    await response.json();


  if (!response.ok) {
    throw new Error(
      result.detail ||
      result.message ||
      "Unable to save user profile."
    );
  }


  return result;
}

// Backend / mock
// Function for changing the logged-in user's password
async function changeLoggedInUserPassword(
  oldPassword,
  newPassword
) {

  /*
    Frontend-only development mode.

    We still let the UI exercise its validation
    and success states, but no password actually
    exists to update.
  */
  if (USE_MOCK_API) {
    return {
      backendConnected: false,
      success: false,
      message:
        "Password change simulated in frontend development mode.",
    };
  }


  /*
    Real backend mode.
  */
  const response =
    await fetch(
      "/api/profile/password",
      {
        method: "PUT",

        headers: {
          "Content-Type":
            "application/json",
        },

        credentials:
          "include",

        body:
          JSON.stringify({
            oldPassword,
            newPassword,
          }),
      }
    );


  const result =
    await response.json();


  return {
    backendConnected: true,
    success: response.ok,
    message:
      result.message ||
      result.detail,
  };
}

// Backend
// Function for updating the user's profile photo
async function updateLoggedInUserProfilePhoto(photoFile) {
  /*
    BACKEND TODO:

    This can later upload the selected profile image to the
    backend. The backend can then store the image or image URL
    against the currently logged-in user.

    This function is not wired to a file picker yet.
  */

  return {
    backendConnected: false,
    success: false,
    photoFile,
  };
}

// Function for generating initials from a user's name. This is used for the profile avatar when no profile image is available.
function getInitials(name) {
  if (!name) {
    return "?";
  }

  const parts = name.trim().split(/\s+/);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return (
    parts[0][0] + parts[parts.length - 1][0]
  ).toUpperCase();
}

function ProfileContent() {
  usePageTitle("Profile");

  const [profile, setProfile] = useState(initialProfile);
  const [saved, setSaved] = useState(false);
  const {
  theme,
  setTheme,
  colorVision,
  setColorVision,
} = useTheme();

  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);
  const [passwordMessage, setPasswordMessage] = useState(null);
  const passwordFieldsComplete =
  passwordForm.oldPassword.trim().length > 0 &&
  passwordForm.newPassword.trim().length > 0 &&
  passwordForm.confirmPassword.trim().length > 0;

  const [
    colorVisionOpen,
    setColorVisionOpen,
  ] = useState(false);

  const colorVisionDropdownRef =
    useRef(null);

  // Load the currently logged-in user's profile when this page opens.
  useEffect(() => {
    let cancelled = false;

    async function loadUserDetails() {
      try {
        const userDetails = await getLoggedInUserDetails();

        if (!cancelled && userDetails) {
          setProfile(userDetails);
        }
      } catch (error) {
        console.error("Unable to load profile:", error);
      }
    }

    loadUserDetails();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {

    function handlePointerDown(event) {

      if (
        colorVisionDropdownRef.current &&
        !colorVisionDropdownRef.current.contains(
          event.target
        )
      ) {
        setColorVisionOpen(false);
      }

    }


    function handleKeyDown(event) {

      if (event.key === "Escape") {
        setColorVisionOpen(false);
      }

    }


    document.addEventListener(
      "pointerdown",
      handlePointerDown
    );

    document.addEventListener(
      "keydown",
      handleKeyDown
    );


    return () => {

      document.removeEventListener(
        "pointerdown",
        handlePointerDown
      );

      document.removeEventListener(
        "keydown",
        handleKeyDown
      );

    };

  }, []);

  const colorVisionOptions = [
    {
      value: "standard",
      label: "Standard",
    },
    {
      value: "deuteranopia",
      label: "Deuteranopia",
    },
    {
      value: "protanopia",
      label: "Protanopia",
    },
    {
      value: "tritanopia",
      label: "Tritanopia",
    },
  ];


  const selectedColorVisionLabel =
    colorVisionOptions.find(
      (option) =>
        option.value === colorVision
    )?.label ?? "Standard";

  // Close the password modal when the user presses Escape.
  useEffect(() => {
    if (!passwordModalOpen) {
      return undefined;
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setPasswordModalOpen(false);
        setPasswordForm(emptyPasswordForm);
        setPasswordMessage(null);
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [passwordModalOpen]);

  function handleFieldChange(event) {
    const { name, value } = event.target;

    setProfile((currentProfile) => ({
      ...currentProfile,
      [name]: value,
    }));

    setSaved(false);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      // Backend call is isolated inside saveLoggedInUserDetails().
      const result = await saveLoggedInUserDetails(profile);

      if (result?.success) {
        setProfile(result.profile);
        setSaved(true);
      }
    } catch (error) {
      console.error("Unable to save profile:", error);
      setSaved(false);
    }
  }

  function openPasswordModal() {
    setPasswordForm(emptyPasswordForm);
    setPasswordMessage(null);
    setPasswordModalOpen(true);
  }

  function closePasswordModal() {
    setPasswordModalOpen(false);
    setPasswordForm(emptyPasswordForm);
    setPasswordMessage(null);
  }

  function handlePasswordFieldChange(event) {
    const { name, value } = event.target;

    setPasswordForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));

    // Remove an old validation message as soon as the user starts editing again.
    setPasswordMessage(null);
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault();

    const { oldPassword, newPassword, confirmPassword } = passwordForm;

    if (!oldPassword || !newPassword || !confirmPassword) {
      setPasswordMessage({
        type: "error",
        text: "Please complete all three password fields.",
      });
      return;
    }

    if (newPassword.length < 8) {
      setPasswordMessage({
        type: "error",
        text: "Your new password must be at least 8 characters long.",
      });
      return;
    }

    if (oldPassword === newPassword) {
      setPasswordMessage({
        type: "error",
        text: "Your new password must be different from your current password.",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({
        type: "error",
        text: "The new password and confirmation do not match.",
      });
      return;
    }

    try {
      // Backend call is isolated inside changeLoggedInUserPassword().
      // confirmPassword is intentionally not sent to the backend.
      const result = await changeLoggedInUserPassword(
        oldPassword,
        newPassword
      );

      if (!result.backendConnected) {
        setPasswordMessage({
          type: "success",
          text: "Password details are valid. Backend connection is still required to apply the change.",
        });
        return;
      }

      if (result.success) {
        setPasswordMessage({
          type: "success",
          text: result.message || "Password updated successfully.",
        });

        setPasswordForm(emptyPasswordForm);
        return;
      }

      setPasswordMessage({
        type: "error",
        text: result.message || "Unable to update password.",
      });
    } catch (error) {
      console.error("Unable to update password:", error);

      setPasswordMessage({
        type: "error",
        text: "Unable to update password. Please try again.",
      });
    }
  }

  return (
    <div className="profile-content">
      <header className="profile-heading">
        <div>
          <p className="profile-eyebrow">Account</p>
          <h1>User Profile</h1>
          <p className="profile-heading-copy">
            Manage the details connected to your TreeNotes account.
          </p>
        </div>

        <button
          className="profile-save-button primary-action"
          type="submit"
          form="profile-form"
        >
          {saved ? "Saved" : "Save changes"}
        </button>
      </header>

      <section className="profile-identity-card" aria-labelledby="profile-name">
        <div className="profile-avatar" aria-hidden="true">
          {getInitials(profile.displayName || profile.fullName)}
        </div>

        <div className="profile-identity-copy">
          <h2 id="profile-name">{profile.displayName || "TreeNotes user"}</h2>
          <p>{profile.email}</p>
          <span>Member since {profile.memberSince || "2026"}</span>
        </div>

        <button className="profile-secondary-button" type="button">
          Change photo
        </button>
      </section>

      <div className="profile-layout-grid">
        <form
          id="profile-form"
          className="profile-card profile-form-card"
          onSubmit={handleSubmit}
        >
          <div className="profile-card-heading">
            <div>
              <h2>Personal information</h2>
              <p>Update how your account appears throughout TreeNotes.</p>
            </div>
          </div>

          <div className="profile-form-grid">
            <label className="profile-field">
              <span>Full name</span>
              <input
                name="fullName"
                type="text"
                value={profile.fullName}
                onChange={handleFieldChange}
                autoComplete="name"
              />
            </label>

            <label className="profile-field">
              <span>Display name</span>
              <input
                name="displayName"
                type="text"
                value={profile.displayName}
                onChange={handleFieldChange}
              />
            </label>

            <label className="profile-field profile-field-wide">
              <span>Email address</span>
              <input
                name="email"
                type="email"
                value={profile.email}
                onChange={handleFieldChange}
                autoComplete="email"
              />
            </label>

            <label className="profile-field profile-field-wide">
              <span>Bio</span>
              <textarea
                name="bio"
                value={profile.bio}
                onChange={handleFieldChange}
                rows="5"
                maxLength="240"
              />
              <small>{profile.bio.length}/240 characters</small>
            </label>
          </div>
        </form>

        <aside className="profile-side-column">
          <section className="profile-card">
            <div className="profile-card-heading">
              <div>
                <h2>Preferences</h2>
                <p>Choose how TreeNotes behaves for your account.</p>
              </div>
            </div>

            <label className="profile-toggle-row">
              <span>
                <strong>Dark appearance</strong>
                <small>Use the dark TreeNotes interface.</small>
              </span>
              <input
                type="checkbox"
                checked={theme === "dark"}
                onChange={(event) => 
                  setTheme(
                    event.target.checked
                      ? "dark"
                      : "light"
                  )
                }
              />
            </label>

            <div className="profile-select-row profile-colour-vision-row">
              <div className="profile-select-copy">
                <label htmlFor="colour-vision">
                  Colour accessibility
                </label>

                <small>
                  Adjust interface colours for improved visual distinction.
                </small>
              </div>

              <div
                className="profile-colour-vision-dropdown"
                ref={colorVisionDropdownRef}
              >

                <button
                  type="button"
                  className={`profile-colour-vision-trigger ${
                    colorVisionOpen
                      ? "profile-colour-vision-trigger-open"
                      : ""
                  }`}
                  aria-haspopup="listbox"
                  aria-expanded={colorVisionOpen}
                  onClick={() =>
                    setColorVisionOpen(
                      (current) => !current
                    )
                  }
                >

                  <span>
                    {selectedColorVisionLabel}
                  </span>

                  <ChevronDown
                    size={15}
                    strokeWidth={1.8}
                    className={`profile-colour-vision-chevron ${
                      colorVisionOpen
                        ? "profile-colour-vision-chevron-open"
                        : ""
                    }`}
                  />

                </button>


                {colorVisionOpen && (

                  <div
                    className="profile-colour-vision-menu"
                    role="listbox"
                    aria-label="Colour vision mode"
                  >

                    {colorVisionOptions.map(
                      (option) => {

                        const isSelected =
                          colorVision ===
                          option.value;


                        return (

                          <button
                            key={option.value}
                            type="button"
                            role="option"
                            aria-selected={
                              isSelected
                            }
                            className={`profile-colour-vision-option ${
                              isSelected
                                ? "profile-colour-vision-option-selected"
                                : ""
                            }`}
                            onClick={() => {

                              setColorVision(
                                option.value
                              );

                              setColorVisionOpen(
                                false
                              );

                            }}
                          >

                            <span>
                              {option.label}
                            </span>

                            {isSelected && (
                              <Check
                                size={14}
                                strokeWidth={2}
                              />
                            )}

                          </button>

                        );

                      }
                    )}

                  </div>

                )}

              </div>
            </div>

          </section>

          <section className="profile-card">
            <div className="profile-card-heading">
              <div>
                <h2>Account security</h2>
                <p>Password and sign-in controls will live here.</p>
              </div>
            </div>

            <button
              className="profile-security-button secondary-action"
              type="button"
              onClick={openPasswordModal}
            >
              Change password
            </button>
          </section>
        </aside>
      </div>

      {passwordModalOpen && (
        <div
          className="profile-modal-backdrop"
          onMouseDown={closePasswordModal}
        >
          <section
            className="profile-password-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="change-password-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="profile-modal-heading">
              <div>
                <p className="profile-eyebrow">Account security</p>
                <h2 id="change-password-title">Change password</h2>
                <p>
                  Enter your current password, then choose a new password for
                  your TreeNotes account.
                </p>
              </div>

              <button
                className="profile-modal-close modal-close-button"
                type="button"
                onClick={closePasswordModal}
                aria-label="Close change password dialog"
              >
                <X
                  size={18}
                  strokeWidth={1.9}
                />
              </button>
            </div>

            <form className="profile-password-form" onSubmit={handlePasswordSubmit}>
              <label className="profile-field">
                <span>Current password</span>
                <input
                  name="oldPassword"
                  type="password"
                  value={passwordForm.oldPassword}
                  onChange={handlePasswordFieldChange}
                  autoComplete="current-password"
                  autoFocus
                />
              </label>

              <label className="profile-field">
                <span>New password</span>
                <input
                  name="newPassword"
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={handlePasswordFieldChange}
                  autoComplete="new-password"
                />
              </label>

              <label className="profile-field">
                <span>Confirm new password</span>
                <input
                  name="confirmPassword"
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={handlePasswordFieldChange}
                  autoComplete="new-password"
                />
              </label>

              {passwordMessage && (
                <p
                  className={`profile-password-message profile-password-message-${passwordMessage.type}`}
                  role="status"
                >
                  {passwordMessage.text}
                </p>
              )}

              <div className="profile-modal-actions">
                <button
                  className="profile-secondary-button secondary-action"
                  type="button"
                  onClick={closePasswordModal}
                >
                  Cancel
                </button>
                <button 
                className="profile-save-button primary-action"
                type="submit"
                disabled={!passwordFieldsComplete}
                >
                  Update password
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

export default ProfileContent;