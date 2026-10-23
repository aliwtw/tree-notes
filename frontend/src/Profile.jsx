import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import ProfileContent from "./components/ProfileContent";

import {
  useEffect,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  getNotes,
  createNote,
  deleteNote,
} from "./api/notesApi";


function Profile() {

  const navigate =
    useNavigate();


  /* =========================================================
     SIDEBAR STATE
     ========================================================= */

  const [notesExpanded, setNotesExpanded] =
    useState(() => {
      return (
        localStorage.getItem(
          "treenotes-sidebar-notes-expanded"
        ) === "true"
      );
    });

  useEffect(() => {

    localStorage.setItem(
      "treenotes-sidebar-notes-expanded",
      String(notesExpanded)
    );

  }, [notesExpanded]);

  const [sidebarCollapsed, setSidebarCollapsed] =
    useState(() => {
      return (
        localStorage.getItem(
          "treenotes-sidebar-collapsed"
        ) === "true"
      );
    });

  useEffect(() => {

    localStorage.setItem(
      "treenotes-sidebar-collapsed",
      String(sidebarCollapsed)
    );

  }, [sidebarCollapsed]);

  const [
    notes,
    setNotes,
  ] = useState([]);


  /* =========================================================
     LOAD NOTES
     ========================================================= */

  useEffect(() => {

    let cancelled = false;


    async function loadNotes() {

      try {

        const loadedNotes =
          await getNotes();


        if (cancelled) {
          return;
        }


        setNotes(
          loadedNotes
        );

      } catch (error) {

        console.error(
          "Unable to load sidebar notes:",
          error
        );

      }

    }


    loadNotes();


    return () => {
      cancelled = true;
    };

  }, []);


  /* =========================================================
     OPEN NOTE
     ========================================================= */

  function handleSelectNote(
    noteId
  ) {

    navigate(
      `/dashboard?note=${encodeURIComponent(
        noteId
      )}`
    );

  }


  /* =========================================================
     CREATE NOTE
     ========================================================= */

  async function handleCreateNote() {

    try {

      const newNote =
        await createNote();


      /*
        Add it locally as well, even though
        we're about to navigate away.
      */
      setNotes(
        currentNotes => [
          newNote,
          ...currentNotes,
        ]
      );


      /*
        Open the newly-created note
        inside Dashboard.
      */
      navigate(
        `/dashboard?note=${encodeURIComponent(
          newNote.id
        )}`
      );

    } catch (error) {

      console.error(
        "Unable to create note:",
        error
      );

    }

  }


  /* =========================================================
     DELETE NOTE
     ========================================================= */

  async function handleDeleteNote(
    noteId
  ) {

    try {

      await deleteNote(
        noteId
      );


      setNotes(
        currentNotes =>
          currentNotes.filter(
            note =>
              note.id !== noteId
          )
      );

    } catch (error) {

      console.error(
        "Unable to delete note:",
        error
      );


      /*
        Re-throw this because Sidebar's
        delete confirmation modal expects
        failed deletions to reject.
      */
      throw error;

    }

  }


  return (

    <main className="dashboard-page">

      <Navbar />


      <div className="dashboard-layout">

        <Sidebar
          notesExpanded={
            notesExpanded
          }

          onNotesToggle={() =>
            setNotesExpanded(
              current => !current
            )
          }

          notes={notes}

          selectedNoteId={null}

          onSelectNote={
            handleSelectNote
          }

          onCreateNote={
            handleCreateNote
          }

          onDeleteNote={
            handleDeleteNote
          }
          
          onConnectionsPageClick={() =>
            navigate(
              "/dashboard?view=connections"
            )
          }

          sidebarCollapsed={
            sidebarCollapsed
          }

          onSidebarToggle={() =>
            setSidebarCollapsed(
              current => !current
            )
          }

          activeView="profile"
        />


        <section className="dashboard-main">

          <ProfileContent />

        </section>

      </div>

    </main>

  );

}


export default Profile;