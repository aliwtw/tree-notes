/*
  =========================================================
  TreeNotes API mode
  =========================================================

  VITE_USE_MOCK_API=true
    Frontend can run independently with npm run dev.

  VITE_USE_MOCK_API=false
    Frontend talks to the real FastAPI backend.
*/

export const USE_MOCK_API =
  import.meta.env.VITE_USE_MOCK_API ===
  "true";