import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  User,
  LogOut,
  Save,
  FileOutput,
  Moon,
  Sun,
} from "lucide-react";

import treeNotesLogo from "../assets/logo.png";
import { useTheme } from "../context/ThemeContext";

import {
  USE_MOCK_API,
} from "../config/apiConfig";

const initialNavbarUser = {
  displayName: "devuser",
  initials: "DEV",
  profileImage: null,
};

/* =========================================================
   BACKEND INTEGRATION
   ========================================================= */

// Function for retrieving logged-in user's navbar details
async function getLoggedInUserNavbarDetails() {
  const response = await fetch("/api/user/navbar", {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Unable to retrieve logged-in user.");
  }

  return await response.json();
}

// Backend
// Function for logging out the currently logged-in user
async function logoutLoggedInUser() {
  const response = await fetch("/api/logout", {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Unable to log out.");
  }

  return {
    backendConnected: true,
    success: true,
  };
}

// Backend
// Function for retrieving the user's profile image
async function getLoggedInUserProfileImage() {
  /*
    BACKEND TODO:

    This may not need its own API endpoint if profileImage
    is already returned by getLoggedInUserNavbarDetails().

    Keep this function only if profile images are retrieved
    separately from the backend.
  */

  return null;
}

function Navbar({
  onSave,
  showNoteActions = false,
}) {
  const [saveStatus, setSaveStatus] =
    useState("idle");
  const [saveError, setSaveError] =
    useState("");

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const [navbarUser, setNavbarUser] = useState(initialNavbarUser);

  const { theme, toggleTheme, } = useTheme();

  const profileMenuRef = useRef(null);
  const navigate = useNavigate();

  // Load the logged-in user's navbar information.
  useEffect(() => {
    let cancelled = false;

    async function loadNavbarUser() {

      /*
        =========================================================
        FRONTEND-ONLY MOCK MODE
        =========================================================
      */

      if (USE_MOCK_API) {

        if (!cancelled) {
          setNavbarUser({
            displayName: "devuser",
            initials: "DEV",
            profileImage: null,
          });
        }

        return;
      }


      /*
        =========================================================
        REAL BACKEND MODE
        =========================================================
      */

      try {
        const userDetails =
          await getLoggedInUserNavbarDetails();

        if (!cancelled && userDetails) {
          setNavbarUser(userDetails);
        }

      } catch (error) {
        console.error(
          "Unable to load navbar user details:",
          error
        );
      }
    }


    loadNavbarUser();


    return () => {
      cancelled = true;
    };

  }, []);

  function toggleProfileMenu() {
    setProfileMenuOpen((current) => !current);
  }

  function closeProfileMenu() {
    setProfileMenuOpen(false);
  }

  async function handleLogout() {

    /*
      Frontend-only mode has no real session.
    */
    if (USE_MOCK_API) {
      setProfileMenuOpen(false);

      navigate("/", {
        replace: true,
      });

      return;
    }


    /*
      Real backend logout.
    */
    try {
      const result =
        await logoutLoggedInUser();

      if (result?.success) {
        setProfileMenuOpen(false);

        navigate("/", {
          replace: true,
        });
      }

    } catch (error) {
      console.error(
        "Unable to log out:",
        error
      );
    }
  }

  async function handleSave() {
    if (!onSave) {
      return;
    }

    setSaveStatus("saving");
    setSaveError("");

    try {
      await onSave();

      setSaveStatus("saved");

      window.setTimeout(() => {
        setSaveStatus("idle");
      }, 1200);

    } catch (error) {
      console.error(
        "Unable to save note:",
        error
      );

      setSaveError(
        error.message ||
        "Unable to save note."
      );

      setSaveStatus("error");
    }
  }

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target)
      ) {
        setProfileMenuOpen(false);
      }
    }
  
      function handleEscape(event) {
      if (event.key === "Escape") {
        setProfileMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <header className="dashboard-navbar">

      <Link
        className="dashboard-brand"
        to="/dashboard"
        aria-label="Go to dashboard"
      >
        <img
          className="dashboard-brand-logo"
          src={treeNotesLogo}
          alt="TreeNotes Logo"
        />

        <div className="dashboard-brand-text">
          <strong>TreeNotes</strong>
          <small>Organise. connect. remember</small>
        </div>
      </Link>

      <div className="navbar-note-actions">

        {showNoteActions && (
          <div className="navbar-note-actions">

            <button
              className="navbar-action-button"
              type="button"
              onClick={handleSave}
              title={
                saveError ||
                "Save current note"
              }
            >
              <Save
                size={24}
                strokeWidth={1.8}
              />

              <span>
                {saveStatus === "saving"
                  ? "Saving..."
                  : saveStatus === "saved"
                    ? "Saved"
                    : saveStatus === "error"
                      ? "Save failed"
                      : "Save"}
              </span>
            </button>


            <button
              className="navbar-action-button"
              type="button"
              disabled
              title="Export is not connected yet"
            >
              <FileOutput
                size={24}
                strokeWidth={1.8}
              />

              <span>
                Export
              </span>
            </button>

          </div>
        )}

        <button
          type="button"
          className="navbar-action-button theme-toggle"

          onClick={toggleTheme}

          data-tooltip={
            theme === "dark"
              ? "Switch to light mode"
              : "Switch to dark mode"
          }

          aria-label={
            theme === "dark"
              ? "Switch to light mode"
              : "Switch to dark mode"
          }
        >

          {theme === "dark" ? (

            <Moon
              size={24}
              strokeWidth={1.8}
            />

          ) : (

            <Sun
              size={24}
              strokeWidth={1.8}
            />

          )}

        </button>
      </div>

      <div
        className="profile-menu-container"
        ref={profileMenuRef}
      >
        <button
          className={`profile-nav-trigger ${
            profileMenuOpen ? "profile-nav-trigger-open" : ""
          }`}
          type="button"
          onClick={toggleProfileMenu}
          aria-haspopup="menu"
          aria-expanded={profileMenuOpen}
        >
          <span className="profile-nav-avatar">
            {navbarUser.profileImage ? (
              <img
                src={navbarUser.profileImage}
                alt=""
                className="profile-nav-avatar-image"
              />
            ) : (
              navbarUser.initials
            )}
          </span>

          <span className="profile-nav-name">
            {navbarUser.displayName}
          </span>

          <span
            className={`profile-nav-chevron ${
              profileMenuOpen
                ? "profile-nav-chevron-open"
                : ""
            }`}
            aria-hidden="true"
          >
            ▾
          </span>
        </button>


        {profileMenuOpen && (
          <div
            className="profile-dropdown"
            role="menu"
          >
            <div className="profile-dropdown-header">
              <span className="profile-dropdown-avatar">
                {navbarUser.profileImage ? (
                  <img
                    src={navbarUser.profileImage}
                    alt=""
                    className="profile-dropdown-avatar-image"
                  />
                ) : (
                  navbarUser.initials
                )}
              </span>

              <div>
                <strong>
                  {navbarUser.displayName}
                </strong>
              </div>
            </div>

            <div className="profile-dropdown-divider" />

            <Link
              className="profile-dropdown-item"
              to="/profile"
              role="menuitem"
              onClick={closeProfileMenu}
            >
              <span
                className="profile-dropdown-icon"
                aria-hidden="true"
              >
                <User size={18} strokeWidth={1.8} />
              </span>

              <span>Profile</span>
            </Link>

            <button
              className="profile-dropdown-item profile-dropdown-logout"
              type="button"
              role="menuitem"
              onClick={handleLogout}
            >
              <span
                className="profile-dropdown-icon"
                aria-hidden="true"
              >
                <LogOut size={18} strokeWidth={1.8} />
              </span>

              <span>Log out</span>
            </button>
          </div>
        )}

      </div>

    </header>
  );
}

export default Navbar;