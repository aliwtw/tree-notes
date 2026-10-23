import treeNotesLogo from "../assets/logo.png";

function DashboardContent() {
  return (
    <div className="dashboard-content">
      <section className="welcome-card">
        <div className="welcome-text">
          <h1 className="dashboard-welcome-heading">
            <span>Select a Note to start</span>
            <span>
              Organising <strong>Knowledge</strong>
            </span>
          </h1>

          <div className="dashboard-feature-list">
            <h2>Tree Notes is:</h2>

            <ul>
              <li>Free &amp; Open Source</li>
              <li>AI-Powered Note Taking</li>
              <li>Graph-Based Knowledge Mapping</li>
              <li>Smart AI Summaries</li>
              <li>Dynamic Keyword Extraction</li>
              <li>Voice-to-Text Note Transcription</li>
              <li>Interactive Graph Visualisation</li>
              <li>AI-Assisted Learning Workflow</li>
            </ul>
          </div>
        </div>

        <div className="welcome-image" aria-hidden="true">
          <img src={treeNotesLogo} alt="" />
        </div>
      </section>
    </div>
  );
}

export default DashboardContent;   