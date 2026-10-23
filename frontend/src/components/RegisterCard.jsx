import { useState } from "react";
import { useNavigate } from "react-router-dom";

function RegisterCard({ onLogin }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Use the useNavigate to navigate to the dashboard after successful login.
  const navigate = useNavigate();

  function validateRegistration() {

    // Full name is optional, so there is deliberately
    // no validation requirement for it.

    if (!email.trim()) {
      return "Please enter your email address.";
    }


    // Same minimum password rule used by the
    // Change Password profile functionality.
    if (password.length < 8) {
      return "Your password must be at least 8 characters long.";
    }

    if (
      new TextEncoder()
        .encode(password)
        .length > 72
    ) {
      return "Your password must be at most 72 bytes long.";
    }


    if (password !== confirmPassword) {
      return "The password and confirmation do not match.";
    }


    return null;
  }


  async function handleSubmit(event) {
    event.preventDefault();

    setError("");


    const validationError =
      validateRegistration();

    if (validationError) {
      setError(validationError);
      return;
    }


    const registrationData = {
      fullName: fullName.trim(),
      email: email.trim(),
      password,
    };


    setLoading(true);


    try {
      const response =
        await fetch(
          "/api/register",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            credentials:
              "include",

            body:
              JSON.stringify(
                registrationData
              ),
          }
        );

      let data = {};

      try {
        data =
          await response.json();
      } catch {
        // Keep fallback message below when the backend
        // returns no JSON body.
      }

      if (!response.ok) {
        let message =
          "Unable to create account.";

        if (
          typeof data?.detail ===
          "string"
        ) {
          message = data.detail;
        } else if (
          Array.isArray(
            data?.detail
          )
        ) {
          message =
            data.detail
              .map((item) =>
                String(item.msg)
                  .replace(
                    /^Value error, /,
                    ""
                  )
              )
              .join(" ");
        }

        throw new Error(message);
      }

      console.log(
        "Registered user:",
        data
      );

      navigate(
        "/dashboard",
        { replace: true }
      );

    } catch (error) {
      console.error(
        "Registration error:",
        error
      );

      setError(
        error.message ||
        "Unable to create account."
      );


    } finally {
      setLoading(false);
    }
  }


  return (
    <div className="logincard auth-card registration-card">

      <h2>Create Account</h2>

      <p className="loginsubtitle">
        Create your TreeNotes account.
      </p>


      <form onSubmit={handleSubmit}>

        {/* Optional personalisation */}

        <label htmlFor="register-name">
          Full name
          <span className="optional-field">
            {" "}Optional
          </span>
        </label>

        <input
          id="register-name"
          type="text"
          placeholder="Your name"
          value={fullName}
          onChange={(event) =>
            setFullName(event.target.value)
          }
          autoComplete="name"
        />


        {/* Required login identity */}

        <label htmlFor="register-email">
          Email
        </label>

        <input
          id="register-email"
          type="email"
          placeholder="email"
          value={email}
          onChange={(event) =>
            setEmail(event.target.value)
          }
          autoComplete="email"
          required
        />


        <label htmlFor="register-password">
          Password
        </label>

        <input
          id="register-password"
          type="password"
          placeholder="password"
          value={password}
          onChange={(event) =>
            setPassword(event.target.value)
          }
          autoComplete="new-password"
          required
        />


        <label htmlFor="register-confirm-password">
          Confirm password
        </label>

        <input
          id="register-confirm-password"
          type="password"
          placeholder="confirm password"
          value={confirmPassword}
          onChange={(event) =>
            setConfirmPassword(event.target.value)
          }
          autoComplete="new-password"
          required
        />


        <small className="password-hint">
          Password must contain at least 8 characters.
        </small>


        {error && (
          <p className="login-error">
            {error}
          </p>
        )}


        <button
          type="submit"
          className="loginbutton"
          disabled={loading}
        >
          {loading
            ? "Creating account..."
            : "Create Account"}
        </button>


        <div className="auth-links-row">

          <button
            type="button"
            className="auth-text-link auth-switch-link"
            onClick={onLogin}
          >
            Have an account? Log in here
          </button>

        </div>

      </form>

    </div>
  );
}


export default RegisterCard;