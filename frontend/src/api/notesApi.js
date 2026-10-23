/* =========================================================
   NOTES API
   =========================================================

   TEMPORARY FRONTEND DEVELOPMENT MODE
   -----------------------------------
   While USE_MOCK_NOTES is true, TreeNotes stores notes in
   browser localStorage.

   This allows the frontend to demonstrate:
   - loading notes
   - creating notes
   - editing/saving notes
   - deleting notes
   - persistence after page refresh

   WITHOUT requiring the real backend database yet.

   Once the backend endpoints are implemented, simply set:

       const USE_MOCK_NOTES = false;

   The exported frontend functions do not need to change.

   Expected backend endpoints:

       GET    /api/notes
       POST   /api/notes
       PATCH  /api/notes/:noteId
       DELETE /api/notes/:noteId
   ========================================================= */

import {
  USE_MOCK_API,
} from "../config/apiConfig";

const USE_MOCK_NOTES = USE_MOCK_API;


/*
  If VITE_API_URL is not supplied, this uses the
  current frontend origin with /api.

  Example .env later:

  VITE_API_URL=http://localhost:3000/api
*/
const API_BASE =
  import.meta.env.VITE_API_URL ??
  "/api";


const STORAGE_KEY =
  "treenotes-dev-notes";



/* =========================================================
   TEMPORARY MOCK DEFAULT NOTES
   =========================================================

   These exist ONLY to provide starter/demo content while
   the frontend is running without the backend database.

   They are inserted only the FIRST time localStorage is
   initialised.

   If the user deletes every note, they are NOT recreated.
   ========================================================= */

const MOCK_DEFAULT_NOTES = [
  {
    id: "note-treenotes-intro",

    title:
      "Introduction to TreeNotes",

    content:
      "TreeNotes is an open-source note-taking application.",

    notes_section:
      "TreeNotes is an open-source note-taking application.",

    notes_section_html:
      "<p>TreeNotes is an open-source note-taking application.</p>",

    summary: "",

    created_at:
      "2026-09-08T00:00:00.000Z",

    updated_at:
      "2026-09-08T00:00:00.000Z",
  },

  {
    id: "note-llms-intro",

    title:
      "Introduction to LLMs",

    content:
      "Large language models can process and generate text.",

    notes_section:
      "Large language models can process and generate text.",

    notes_section_html:
      "<p>Large language models can process and generate text.</p>",

    summary: "",

    created_at:
      "2026-09-08T00:00:00.000Z",

    updated_at:
      "2026-09-08T00:00:00.000Z",
  },
];



/* =========================================================
   NOTE NORMALISATION
   =========================================================

   Keeps the frontend note structure consistent whether the
   data came from:

   - localStorage mock data
   - the future backend/database
   ========================================================= */

function normaliseNote(note) {
  const plainText =
    note.notes_section ??
    note.content ??
    "";

  return {
    ...note,

    title:
      note.title ||
      "Untitled Note",

    /*
      content and notes_section currently represent the
      plain-text/raw-note content.

      Keeping both populated means existing frontend code
      continues to work while backend naming is finalised.
    */
    content:
      plainText,

    notes_section:
      plainText,

    notes_section_html:
      note.notes_section_html ??
      "",

    summary:
      note.summary_section ??
      note.summary ??
      "",

    summary_section:
      note.summary_section ??
      note.summary ??
      "",

    graph_json:
      note.graph_json ??
      null,

    group_id:
      note.group_id ??
      null,

    created_at:
      note.created_at ??
      null,

    updated_at:
      note.updated_at ??
      null,
  };
}



/*
  Ensures updates using either:

      content

  or:

      notes_section

  keep both frontend fields synchronised.
*/
function normaliseNoteUpdates(
  updates = {}
) {
  const normalised = {
    ...updates,
  };

  if (
    updates.notes_section !== undefined
  ) {
    normalised.content =
      updates.notes_section;
  }

  if (
    updates.content !== undefined &&
    updates.notes_section === undefined
  ) {
    normalised.notes_section =
      updates.content;
  }

  // The backend stores the user's summary as summary_section.
  // Accept the older frontend "summary" name, but never send it
  // as an unknown key.
  if (
    updates.summary !== undefined &&
    updates.summary_section === undefined
  ) {
    normalised.summary_section =
      updates.summary;
  }

  delete normalised.summary;

  // PATCH semantics: omit title to leave it unchanged.
  // An explicit null is rejected by the backend.
  if (
    updates.title === null ||
    updates.title === undefined
  ) {
    delete normalised.title;
  }

  return normalised;
}


/* =========================================================
   MOCK STORAGE
   ========================================================= */

function readMockNotes() {
  const stored =
    localStorage.getItem(
      STORAGE_KEY
    );


  /*
    If this key has NEVER existed,
    initialise the temporary mock database
    with the two demonstration notes.
  */
  if (stored === null) {
    const initialNotes =
      MOCK_DEFAULT_NOTES.map(
        normaliseNote
      );


    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        initialNotes
      )
    );


    return initialNotes;
  }


  /*
    Otherwise load whatever currently exists.

    Important:
    An empty array is valid.

    We must NOT recreate the starter notes merely
    because the user deleted every note.
  */
  try {
    const parsed =
      JSON.parse(stored);


    if (!Array.isArray(parsed)) {
      console.error(
        "Mock notes storage was not an array."
      );

      return [];
    }


    return parsed.map(
      normaliseNote
    );

  } catch (error) {

    console.error(
      "Unable to read mock notes:",
      error
    );


    return [];
  }
}



function writeMockNotes(notes) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(notes)
  );
}



function errorMessage(data, fallback) {
  if (typeof data?.detail === "string") {
    return data.detail;
  }

  if (Array.isArray(data?.detail)) {
    return data.detail
      .map((error) =>
        String(error.msg)
          .replace(/^Value error, /, "")
      )
      .join(" ");
  }

  return (
    data?.message ??
    data?.error ??
    fallback
  );
}


/* =========================================================
   BACKEND RESPONSE HELPER
   ========================================================= */

async function handleApiResponse(
  response,
  fallbackMessage
) {
  if (!response.ok) {
    if (response.status === 401) {
      window.location.replace("/");
    }

    let message =
      fallbackMessage;


    try {
      const data =
        await response.json();


      message =
        errorMessage(
          data,
          message
        );

    } catch {
      /*
        Backend did not return JSON.
        Use the fallback message.
      */
    }


    throw new Error(message);
  }


  /*
    DELETE commonly returns HTTP 204 with
    no JSON response body.
  */
  if (response.status === 204) {
    return null;
  }


  return response.json();
}



/* =========================================================
   LIST NOTES
   =========================================================

   FRONTEND USAGE:

       const notes = await getNotes();

   MOCK:
       Reads localStorage.

   BACKEND:
       GET /api/notes

   Recommended backend response:

       {
         "notes": [...]
       }

   An array response is also accepted temporarily.
   ========================================================= */

export async function getNotes() {

  /* -----------------------------------------
     TEMPORARY MOCK IMPLEMENTATION
     ----------------------------------------- */

  if (USE_MOCK_NOTES) {
    return readMockNotes();
  }


  /* -----------------------------------------
     REAL BACKEND IMPLEMENTATION
     ----------------------------------------- */

  const response =
    await fetch(
      `${API_BASE}/notes`,
      {
        method: "GET",

        /*
          Assumes authentication is currently
          handled through session cookies.
        */
        credentials:
          "include",
      }
    );


  const data =
    await handleApiResponse(
      response,
      "Unable to load notes."
    );


  const notes =
    data?.notes ??
    data ??
    [];


  if (!Array.isArray(notes)) {
    throw new Error(
      "Backend returned an invalid notes response."
    );
  }


  return notes.map(
    normaliseNote
  );
}



/* =========================================================
   CREATE NOTE
   =========================================================

   Existing frontend code can continue calling:

       createNote()

   with no arguments.

   It can also later call:

       createNote({
         title: "...",
         notes_section: "..."
       })

   MOCK:
       Creates note in localStorage.

   BACKEND:
       POST /api/notes

   Recommended response:

       {
         "note": {
           ...
         }
       }

   or simply the note object itself.
   ========================================================= */

export async function createNote(
  noteData = {}
) {

  const now =
    new Date().toISOString();


  const requestedNote =
    normaliseNote({
      title:
        noteData.title ??
        "Untitled Note",

      notes_section:
        noteData.notes_section ??
        noteData.content ??
        "",

      notes_section_html:
        noteData.notes_section_html ??
        "",

      summary_section:
        noteData.summary_section ??
        noteData.summary ??
        "",

      graph_json:
        noteData.graph_json ??
        null,

      group_id:
        noteData.group_id ??
        null,

      created_at:
        now,

      updated_at:
        now,
    });



  /* -----------------------------------------
     TEMPORARY MOCK IMPLEMENTATION
     ----------------------------------------- */

  if (USE_MOCK_NOTES) {

    const note =
      normaliseNote({
        ...requestedNote,

        id:
          crypto.randomUUID?.() ??
          `local-${Date.now()}`,
      });


    const notes =
      readMockNotes();


    writeMockNotes([
      ...notes,
      note,
    ]);


    return note;
  }



  /* -----------------------------------------
     REAL BACKEND IMPLEMENTATION
     ----------------------------------------- */

  const response =
    await fetch(
      `${API_BASE}/notes`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        credentials:
          "include",

        body:
          JSON.stringify({
            title:
              requestedNote.title,

            notes_section:
              requestedNote.notes_section,

            notes_section_html:
              requestedNote.notes_section_html,

            summary_section:
              requestedNote.summary_section,

            group_id:
              requestedNote.group_id,

            ...(noteData.graph_json !== undefined
              ? {
                  graph_json:
                    requestedNote.graph_json,
                }
              : {}),
          }),
      }
    );


  const data =
    await handleApiResponse(
      response,
      "Unable to create note."
    );


  return normaliseNote(
    data?.note ??
    data
  );
}



/* =========================================================
   UPDATE / SAVE NOTE
   =========================================================

   FRONTEND USAGE:

       updateNote(noteId, {
         title,
         notes_section,
         notes_section_html,
         summary
       });

   MOCK:
       Updates localStorage.

   BACKEND:
       PATCH /api/notes/:noteId

   PATCH is intentionally used because TreeNotes may save
   only part of a note at a time.
   ========================================================= */

export async function updateNote(
  noteId,
  updates
) {

  const safeUpdates =
    normaliseNoteUpdates(
      updates
    );



  /* -----------------------------------------
     TEMPORARY MOCK IMPLEMENTATION
     ----------------------------------------- */

  if (USE_MOCK_NOTES) {

    let updatedNote = null;


    const notes =
      readMockNotes().map(
        (note) => {

          if (
            note.id !== noteId
          ) {
            return note;
          }


          updatedNote =
            normaliseNote({
              ...note,

              ...safeUpdates,

              updated_at:
                new Date()
                  .toISOString(),
            });


          return updatedNote;
        }
      );


    writeMockNotes(notes);


    if (!updatedNote) {
      throw new Error(
        "Unable to find note to update."
      );
    }


    return updatedNote;
  }



  /* -----------------------------------------
     REAL BACKEND IMPLEMENTATION
     ----------------------------------------- */

  const response =
    await fetch(
      `${API_BASE}/notes/${noteId}`,
      {
        method: "PATCH",

        headers: {
          "Content-Type":
            "application/json",
        },

        credentials:
          "include",

        body:
          JSON.stringify(
            safeUpdates
          ),
      }
    );


  const data =
    await handleApiResponse(
      response,
      "Unable to save note."
    );


  return normaliseNote(
    data?.note ??
    data
  );
}



/* =========================================================
   DELETE NOTE
   =========================================================

   FRONTEND USAGE:

       await deleteNote(noteId);

   MOCK:
       Removes note from localStorage.

   BACKEND:
       DELETE /api/notes/:noteId

   Backend should also remove/cascade associated data
   belonging to this note, such as:

       - graph nodes
       - graph edges
       - summary data
       - AI metadata

   if those are stored separately.
   ========================================================= */

export async function deleteNote(
  noteId
) {

  /* -----------------------------------------
     TEMPORARY MOCK IMPLEMENTATION
     ----------------------------------------- */

  if (USE_MOCK_NOTES) {

    const notes =
      readMockNotes();


    const noteExists =
      notes.some(
        (note) =>
          note.id === noteId
      );


    if (!noteExists) {
      throw new Error(
        "Unable to find note to delete."
      );
    }


    const remainingNotes =
      notes.filter(
        (note) =>
          note.id !== noteId
      );


    writeMockNotes(
      remainingNotes
    );


    return;
  }



  /* -----------------------------------------
     REAL BACKEND IMPLEMENTATION
     ----------------------------------------- */

  const response =
    await fetch(
      `${API_BASE}/notes/${noteId}`,
      {
        method: "DELETE",

        credentials:
          "include",
      }
    );


  await handleApiResponse(
    response,
    "Unable to delete note."
  );
}