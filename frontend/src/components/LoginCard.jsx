import { useState } from "react";
import { useNavigate } from "react-router-dom";

function LoginCard({ onCreateAccount }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Use the useNavigate to navigate to the dashboard after successful login.
  const navigate = useNavigate();

  async function handleSubmit(event) {
    event.preventDefault();

    const loginData = {
      email,
      password,
    };

    setLoading(true);
    setError("");

    try {
      const response =
        await fetch(
          "/api/login",
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
                loginData
              ),
          }
        );

      let data = {};

      try {
        data =
          await response.json();
      } catch {
        // Use the fallback message below.
      }

      if (!response.ok) {
        let message =
          "Unable to login.";

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
        "Logged in user:",
        data
      );

      navigate(
        "/dashboard",
        { replace: true }
      );

    } catch (error) {
      console.error(
        "Login error:",
        error
      );

      setError(
        error.message ||
        "Unable to login."
      );

    } finally {
      setLoading(false);
    }
  }


  return (
    <div className="logincard auth-card">

      <h2>Welcome Back!</h2>

      <p className="loginsubtitle">
        Login to continue to TreeNotes.
      </p>


      <form onSubmit={handleSubmit}>

        <label htmlFor="login-email">
          Email
        </label>

        <input
          id="login-email"
          type="email"
          placeholder="email"
          value={email}
          onChange={(event) =>
            setEmail(event.target.value)
          }
          autoComplete="email"
          required
        />


        <label htmlFor="login-password">
          Password
        </label>

        <input
          id="login-password"
          type="password"
          placeholder="password"
          value={password}
          onChange={(event) =>
            setPassword(event.target.value)
          }
          autoComplete="current-password"
          required
        />


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
            ? "Logging in..."
            : "Login"}
        </button>


        <div className="auth-links-row">

          <button
            type="button"
            className="auth-text-link auth-switch-link"
            onClick={onCreateAccount}
          >
            No account? Create new one
          </button>


          <a
            href="#"
            className="auth-text-link forgotpassword"
          >
            Forgot Password?
          </a>

        </div>


        <div className="divider">
          <span />
          <p>Or</p>
          <span />
        </div>


        <button
          type="button"
          className="googlebutton"
        >
          Continue with Google
        </button>

      </form>

    </div>
  );
}


export default LoginCard;