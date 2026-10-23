import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import DashboardContent from "./components/DashboardContent";
import NoteWorkspace from "./components/NoteWorkspace";
import usePageTitle from "./hooks/usePageTitle";
import MasterGraph from "./components/MasterGraph";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  useSearchParams,
} from "react-router-dom";

import {
  getNotes,
  createNote,
  deleteNote,
} from "./api/notesApi";


function Dashboard() {

  usePageTitle("Dashboard");
  // =========================================================
  // SIDEBAR STATE
  // =========================================================

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

  const [activeView, setActiveView] =
  useState("dashboard");


  // =========================================================
  // NOTES STATE
  // =========================================================

  // Stores all notes belonging to the user
  const [notes, setNotes] =
    useState([]);

  // Stores the ID of the note currently being viewed
  const [selectedNoteId, setSelectedNoteId] =
    useState(null);

  // Optional loading state while notes are being retrieved
  const [notesLoading, setNotesLoading] =
    useState(true);


  /*
    Find the complete selected note object
    from its ID.

    This means if the note is renamed/saved,
    Dashboard always gets the newest version
    from the notes array.
  */
  const selectedNote =
    notes.find(
      (note) =>
        note.id === selectedNoteId
    ) ?? null;

  const [
    searchParams,
    setSearchParams,
  ] = useSearchParams();

  const requestedNoteId =
    searchParams.get("note");

  const requestedView =
    searchParams.get("view");

  // =========================================================
  // WORKSPACE REFERENCE
  // =========================================================

  // Workspace reference used by Navbar Save button
  const noteWorkspaceRef =
    useRef(null);


  // =========================================================
  // LOAD NOTES
  // =========================================================

  useEffect(() => {

    async function loadNotes() {

      try {

        const loadedNotes =
          await getNotes();


        setNotes(
          loadedNotes
        );


        /*
          Do not automatically open the first note.

          This preserves your current behaviour where
          DashboardContent is shown until the user
          chooses a note.

          If you later want the first note to open
          automatically, we can change this.
        */

      } catch (error) {

        console.error(
          "Unable to load notes:",
          error
        );

      } finally {

        setNotesLoading(false);

      }
    }


    loadNotes();

  }, []);


  // =========================================================
  // SELECT NOTE
  // =========================================================

  function handleSelectNote(noteId) {

    setSelectedNoteId(
      noteId
    );

  }

  function openNote(noteId) {

    setSearchParams({
      note: String(noteId),
    });

  }

  function openConnectionsPage() {

    setSearchParams({
      view:
        "connections",
    });

  }

  function clearOpenNote() {

    setSearchParams({});

    setSelectedNoteId(null);

  }

  useEffect(() => {

  if (notesLoading) {
    return;
  }


  /*
    CONNECTIONS PAGE
  */
  if (
    requestedView ===
    "connections"
  ) {

    setSelectedNoteId(
      null
    );

    setActiveView(
      "connections"
    );

    return;
  }


  /*
    PLAIN DASHBOARD
  */
  if (!requestedNoteId) {

    setSelectedNoteId(
      null
    );

    setActiveView(
      "dashboard"
    );

    return;
  }


  /*
    SPECIFIC NOTE
  */
  const requestedNote =
    notes.find(
      note =>
        String(note.id) ===
        String(requestedNoteId)
    );


  if (!requestedNote) {

    setSelectedNoteId(
      null
    );

    setActiveView(
      "dashboard"
    );

    return;
  }


  if (
    String(
      selectedNoteId ?? ""
    ) !==
    String(
      requestedNote.id
    )
  ) {

    setSelectedNoteId(
      requestedNote.id
    );

  }


  setActiveView(
    "dashboard"
  );

}, [
  requestedView,
  requestedNoteId,
  notes,
  notesLoading,
  selectedNoteId,
]);

  // =========================================================
  // CREATE NOTE
  // =========================================================

  async function handleCreateNote() {

    try {

      const newNote =
        await createNote();


      /*
        Add the new note to the sidebar list.
      */
      setNotes((currentNotes) => [
        newNote,
        ...currentNotes,
      ]);


      /*
        Automatically open the new note.
      */
      openNote(
        newNote.id
      );


      /*
        Make sure the notes dropdown is visible.
      */
      setNotesExpanded(true);

    } catch (error) {

      console.error(
        "Unable to create note:",
        error
      );

    }
  }


  // =========================================================
  // DELETE NOTE
  // =========================================================

  async function handleDeleteNote(noteId) {

    try {

      /*
        Delete from mock storage / future backend first.
      */
      await deleteNote(
        noteId
      );


      /*
        Work out which note should be selected afterwards.
      */
      const deletedIndex =
        notes.findIndex(
          (note) =>
            note.id === noteId
        );


      const remainingNotes =
        notes.filter(
          (note) =>
            note.id !== noteId
        );


      setNotes(
        remainingNotes
      );


      /*
        Only change the selected note if
        the user deleted the note currently open.
      */
      if (
        selectedNoteId === noteId
      ) {

        /*
          Prefer the note that came after the deleted
          note. If none exists, use the previous note.

          If no notes remain, selectedNote becomes null
          and DashboardContent appears again.
        */
        const nextNote =
          remainingNotes[deletedIndex] ??
          remainingNotes[deletedIndex - 1] ??
          null;


        setSelectedNoteId(
          nextNote?.id ?? null
        );
      }

    } catch (error) {

      console.error(
        "Unable to delete note:",
        error
      );


      /*
        Important:

        Let Sidebar know the deletion failed so
        its confirmation modal can display an error.
      */
      throw error;

    }
  }


  // =========================================================
  // NOTE SAVED
  // =========================================================

  function handleNoteSaved(savedNote) {

    /*
      Replace the old note in Dashboard state with
      the version returned by notesApi.

      This means title changes immediately appear
      in the Sidebar after pressing Save.
    */
    setNotes((currentNotes) =>
      currentNotes.map(
        (note) =>
          note.id === savedNote.id
            ? savedNote
            : note
      )
    );

  }


  // =========================================================
  // PAGE
  // =========================================================

  return (

    <main className="dashboard-page">

      <Navbar
        onSave={() =>
          noteWorkspaceRef.current
            ?.saveEverything()
        }

        showNoteActions={
          Boolean(selectedNote?.id)
        }
      />


      <div className="dashboard-layout">

        <Sidebar

          // Notes dropdown
          notesExpanded={notesExpanded}

          onNotesToggle={() =>
            setNotesExpanded(
              (current) =>
                !current
            )
          }

          // Dynamic notes
          notes={notes}

          selectedNoteId={
            selectedNoteId
          }

          onSelectNote={
            openNote
          }

          onCreateNote={
            handleCreateNote
          }

          onDeleteNote={
            handleDeleteNote
          }

          onConnectionsPageClick={
            openConnectionsPage
          }

          // Sidebar collapse
          sidebarCollapsed={
            sidebarCollapsed
          }

          onSidebarToggle={() =>
            setSidebarCollapsed(
              (current) =>
                !current
            )
          }
          activeView={activeView}

        />


        <section className="dashboard-main">

          {notesLoading ? (

          <div className="dashboard-loading">
            Loading notes...
          </div>

        ) : selectedNote ? (

          <NoteWorkspace
            key={selectedNote.id}
            note={selectedNote}
            ref={noteWorkspaceRef}
            onNoteSaved={handleNoteSaved}
          />

        ) : activeView === "connections" ? (

          <MasterGraph
            notes={notes}
            onOpenNote={
              openNote
            }
          />

        ) : (

          <DashboardContent />

        )}

        </section>

      </div>

    </main>

  );

}


export default Dashboard;