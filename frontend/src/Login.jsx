import "./App.css";
import { useState } from "react";
import usePageTitle from "./hooks/usePageTitle";
import treeNotesWideLogo from "./assets/logo-wide.png";

import treeGraph from "./assets/graph.png";

import LoginCard from "./components/LoginCard";
import RegisterCard from "./components/RegisterCard";


function Login() {
  usePageTitle("Login or Sign Up");

  // Controls whether the user sees Login or Registration.
  const [authView, setAuthView] = useState("login");

  return (
    <main className="loginpage">

      {/* =============================== */}
      {/* Navigation                      */}
      {/* =============================== */}

      <nav className="navbar">

        <img
          src={treeNotesWideLogo}
          alt="TreeNotes - Organise. Connect. Remember"
          className="login-brand-logo"
        />

        <div className="navlinks">
          <a href="#">Features</a>
          <a href="#">Docs</a>
          <a href="#">GitHub</a>

          <button
            type="button"
            onClick={() => setAuthView("login")}
          >
            Login
          </button>
        </div>

      </nav>


      <section className="maincontent">

        {/* =============================== */}
        {/* Hero                            */}
        {/* =============================== */}

        <section className="herosection">

          <h1>
            Organize Ideas, <br />
            grow <span>Knowledge</span>
          </h1>

          <p>
            TreeNotes is an open-source note-taking web app that helps organise
            your ideas as a tree and connect what matters.
          </p>

          <div className="graphpreview">
            <img
              src={treeGraph}
              alt="TreeNotes knowledge graph"
            />
          </div>

        </section>


        {/* =============================== */}
        {/* Authentication                  */}
        {/* =============================== */}

        <section className="loginsection">

          {authView === "login" ? (
            <LoginCard
              onCreateAccount={() =>
                setAuthView("register")
              }
            />
          ) : (
            <RegisterCard
              onLogin={() =>
                setAuthView("login")
              }
            />
          )}

        </section>

      </section>


      <footer className="footer">
        © 2026 TreeNotes. Open-source under MIT License.
      </footer>

    </main>
  );
}


export default Login;