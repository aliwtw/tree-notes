/* =========================================================
   GRAPH API
   =========================================================

   TEMPORARY FRONTEND DEVELOPMENT MODE
   -----------------------------------
   While USE_MOCK_GRAPH_API is true, semantic graph search
   uses temporary frontend mock matching.

   This allows the frontend to demonstrate:

   - opening semantic search
   - searching for a graph concept
   - selecting/focusing the matched Cytoscape node
   - successful search feedback
   - no-match/error feedback

   WITHOUT requiring the AI/backend search service yet.

   Once the backend endpoint is implemented, simply set:

       const USE_MOCK_GRAPH_API = false;

   GraphPanel does NOT need to change apart from passing
   graphData into semanticSearchGraph().

   Expected backend endpoint:

       POST /api/notes/:noteId/graph/search

   Recommended future graph persistence endpoints:

       GET /api/notes/:noteId/graph
       PUT /api/notes/:noteId/graph
   ========================================================= */

import {
  USE_MOCK_API,
} from "../config/apiConfig";

const USE_MOCK_GRAPH_API = USE_MOCK_API;

/*
  Optional backend URL.

  If VITE_API_URL is not defined, requests use:

      /api

  Example .env later:

      VITE_API_URL=http://localhost:3000/api
*/

const API_BASE = import.meta.env.VITE_API_URL ?? "/api";

/* =========================================================
   TEMPORARY MOCK SEMANTIC SEARCH
   =========================================================

   These search terms exist ONLY for frontend development.

   They currently point toward the JavaScript node in the
   mock graph.

   The backend will eventually replace this with real
   fuzzy / semantic / embedding-based matching.
   ========================================================= */

const MOCK_SEMANTIC_MATCHES = [
  "java",
  "script",
  "programming",
];

const MOCK_JAVASCRIPT_NODE = {
  node_id: "2",
  label: "JavaScript",
  score: 0.95,
};

/* =========================================================
   PREPARE GRAPH FOR SEMANTIC SEARCH
   =========================================================

   Converts the frontend graph into a small backend-friendly
   structure containing the information needed by semantic
   search.

   This gives the AI/backend:

       - node IDs
       - node labels
       - node relationships
       - optional semantic node/edge metadata

   Cytoscape styling and position information is not needed
   for semantic matching, so it is not included here.

   Supports both:

       { data: { id, label } }

   and:

       { id, label }

   graph structures.
   ========================================================= */

function prepareGraphForSearch(graphData) {
  const nodes = graphData?.nodes?.map((node) => {
        const data = node.data ?? node;

        return {
          id: String(data.id),
          label: data.label ?? "",

          // Optional semantic information. These will simply be undefined if your current graph does not use them.
          type: data.type ?? undefined,
          category: data.category ?? undefined,
        };
      }) ?? [];

  const edges = graphData?.edges?.map((edge) => {
        const data = edge.data ?? edge;

        return {
          id: data.id != null ? String(data.id) : null,
          source:String(data.source),
          target: String(data.target),

          // Useful later if relationships receive names such as "uses", "contains", etc.
          label: data.label ?? undefined,
          type: data.type ?? undefined,
        };
      }) ?? [];

  return { nodes, edges };
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

async function handleApiResponse(response, fallbackMessage) {

  if (!response.ok) {
    if (response.status === 401) {
      window.location.replace("/");
    }

    let message = fallbackMessage;

    try {
      const data = await response.json();
      message = errorMessage(data, message);
    }
    catch
    {
      // Backend did not return JSON. Continue using the fallback message.
    }

    throw new Error(message);
  }

  // Some future graph operations may return HTTP 204 with no response body.

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

/* =========================================================
   SEARCH RESULT NORMALISATION
   =========================================================

   Keeps the frontend contract predictable.

   GraphPanel expects:

       {
         match: {
           node_id: "2",
           label: "JavaScript",
           score: 0.95
         }
       }

   or:

       {
         match: null
       }

   Cytoscape node IDs are treated as strings, so this also
   converts numeric database IDs if necessary.
   ========================================================= */

function normaliseSearchResult(data) {
  const match = data?.match ?? null;

  if (!match) {
    return { match: null };
  }

  const nodeId =
    String(match.node_id);

  const score =
    match.score ?? null;

  if (
    nodeId === "-1" ||
    (
      typeof score === "number" &&
      score < 0
    )
  ) {
    return { match: null };
  }

  return {
    match: {
      ...match,
      node_id: nodeId,
      label: match.label ?? "",
      score,
    },
  };
}

/* =========================================================
   SEMANTIC GRAPH SEARCH
   =========================================================

   FRONTEND USAGE:

       const result =
         await semanticSearchGraph(
           noteId,
           query,
           graphData
         );


   ---------------------------------------------------------
   MOCK MODE
   ---------------------------------------------------------

   Searches containing:

       java
       script
       programming

   currently return the JavaScript node.

   Importantly, the mock now tries to locate JavaScript
   inside the CURRENT graph data instead of always assuming
   node ID "2".

   This makes the mock more representative of how the real
   backend will operate.

   Any other search returns:

       match: null


   ---------------------------------------------------------
   BACKEND MODE
   ---------------------------------------------------------

   POST:

       /api/notes/:noteId/graph/search

   Request:

       {
         "query": "java",

         "graph": {
           "nodes": [
             {
               "id": "1",
               "label": "React"
             },
             {
               "id": "2",
               "label": "JavaScript"
             }
           ],

           "edges": [
             {
               "id": "edge-1",
               "source": "1",
               "target": "2"
             }
           ]
         }
       }


   Recommended successful backend response:

       {
         "match": {
           "node_id": "2",
           "label": "JavaScript",
           "score": 0.95
         }
       }


   No semantic match:

       {
         "match": null
       }

   ========================================================= */

export async function semanticSearchGraph(noteId, query, graphData) {

  const normalizedQuery = query.trim().toLowerCase();

  // Prepare the graph once. Both mock mode and real backend mode can therefore inspect the exact same graph structure.
  const searchGraph = prepareGraphForSearch(graphData);

  /* =======================================================
     TEMPORARY MOCK IMPLEMENTATION
     ======================================================= */

    if (USE_MOCK_GRAPH_API) {
      console.log(
        "Mock semantic graph search:",
        {
          noteId,
          query,
          graph: searchGraph,
        }
      );

      await new Promise((resolve) =>
        setTimeout(resolve, 500)
      );

      if (!normalizedQuery) {
        return {
          match: null,
        };
      }

      const hasMockMatch =
        MOCK_SEMANTIC_MATCHES.some(
          (keyword) =>
            normalizedQuery.includes(keyword)
        );

      if (hasMockMatch) {
        const javascriptNode =
          searchGraph.nodes.find(
            (node) =>
              node.label
                ?.trim()
                .toLowerCase() ===
              "javascript"
          );

        if (javascriptNode) {
          return {
            match: {
              node_id:
                javascriptNode.id,

              label:
                javascriptNode.label,

              score:
                0.95,
            },
          };
        }

        return {
          match: {
            ...MOCK_JAVASCRIPT_NODE,
          },
        };
      }

      return {
        match: null,
      };
    }

  /* =======================================================
     REAL BACKEND IMPLEMENTATION
     ======================================================= */

  if (!noteId) { throw new Error("A note ID is required to search the graph."); }

  if (!normalizedQuery) { throw new Error("A search query is required."); }

  const response = await fetch(`${API_BASE}/notes/${noteId}/graph/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // Assumes authentication currently uses the user's session cookie.

        // IMPORTANT: The graph is sent alongside the query so the semantic-search backend can reason about both node meaning AND node relationships.
        body: JSON.stringify({
            query: query.trim(),
            graph: searchGraph,
        })
  });

  const data = await handleApiResponse(response, "Unable to search the graph.");

  return normaliseSearchResult(data);
}

/* =========================================================
   FUTURE: LOAD SAVED GRAPH
   =========================================================

   This is ready for backend integration but does not
   interfere with the current mock graph inside GraphPanel.

   Backend endpoint:

       GET /api/notes/:noteId/graph

   Suggested response:

       {
         "nodes": [...],
         "edges": [...]
       }

   You do NOT need to use this function in GraphPanel yet.
   ========================================================= */

export async function getGraph(noteId) {
  if (USE_MOCK_GRAPH_API) {
    console.log("Mock graph load skipped:", { noteId });
    return { nodes: [], edges: [] };
  }


  const response = await fetch(`${API_BASE}/notes/${noteId}/graph`, {
        method: "GET",
        credentials: "include",
  });

  return handleApiResponse(response, "Unable to load graph.");
}

/* =========================================================
   FUTURE: SAVE GRAPH
   =========================================================

   Intended for the Navbar Save workflow later.

   Backend endpoint:

       PUT /api/notes/:noteId/graph

   Example graphData:

       {
         "nodes": [
           {
             "id": "1",
             "label": "React",
             "color": "#6366f1",
             "shape": "rectangle",
             "position": {
               "x": 250,
               "y": 160
             }
           }
         ],

         "edges": [
           {
             "id": "edge-1",
             "source": "1",
             "target": "2"
           }
         ]
       }

   This function can remain unused until graph persistence
   is connected.
   ========================================================= */

export async function saveGraph(noteId, graphData) {
  if (USE_MOCK_GRAPH_API) {
    // We currently do NOT persist the mock Cytoscape graph.
    //Keeping this as a harmless development stub means the real API contract is already documented without changing current frontend behaviour.
    console.log("Mock graph save:", { noteId, graphData });
    return graphData;
  }

  const response = await fetch(`${API_BASE}/notes/${noteId}/graph`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(graphData)
  });

  return handleApiResponse(response, "Unable to save graph.");
}