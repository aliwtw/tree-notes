import { useEffect, useRef } from "react";
import cytoscape from "cytoscape";

const GROUP_COLORS = [
  "#6366F1", // purple
  "#06B6D4", // cyan
  "#22C55E", // green
  "#F59E0B", // amber
  "#EC4899", // pink
  "#3B82F6", // blue
  "#14B8A6", // teal
  "#F97316", // orange
];

function assignGroupColors(
  noteNodes,
  noteEdges
) {
  const adjacency = new Map();

  noteNodes.forEach((node) => {
    adjacency.set(
      node.data.id,
      []
    );
  });

  noteEdges.forEach((edge) => {
    const {
      source,
      target,
    } = edge.data;

    adjacency
      .get(source)
      ?.push(target);

    adjacency
      .get(target)
      ?.push(source);
  });

  const visited = new Set();
  let groupIndex = 0;

  noteNodes.forEach((node) => {
    const nodeId = node.data.id;

    if (visited.has(nodeId)) {
      return;
    }

    const color =
      GROUP_COLORS[
        groupIndex %
        GROUP_COLORS.length
      ];

    groupIndex += 1;

    const stack = [nodeId];

    while (stack.length > 0) {
      const currentId =
        stack.pop();

      if (
        visited.has(currentId)
      ) {
        continue;
      }

      visited.add(currentId);

      const currentNode =
        noteNodes.find(
          (item) =>
            item.data.id ===
            currentId
        );

      if (currentNode) {
        currentNode.data.groupColor =
          color;
      }

      const neighbours =
        adjacency.get(currentId) || [];

      neighbours.forEach(
        (neighbour) => {
          if (
            !visited.has(neighbour)
          ) {
            stack.push(neighbour);
          }
        }
      );
    }
  });

  return noteNodes;
}

function getThemeToken(
  tokenName,
  fallback
) {
  const value =
    getComputedStyle(
      document.documentElement
    )
      .getPropertyValue(
        tokenName
      )
      .trim();

  return value || fallback;
}


function getMasterGraphTheme() {

  return {

    nodeBackground:
      getThemeToken(
        "--graph-node-bg",
        "#6366f1"
      ),

    nodeBorder:
      getThemeToken(
        "--graph-node-border",
        "#7772ff"
      ),

    nodeText:
      getThemeToken(
        "--graph-node-text",
        "#ffffff"
      ),

    edge:
      getThemeToken(
        "--graph-edge",
        "#5b6b88"
      ),

    edgeArrow:
      getThemeToken(
        "--graph-edge-arrow",
        "#7c8cff"
      ),

  };

}

function applyMasterGraphTheme(
  cy
) {

  if (!cy) {
    return;
  }


  const graphTheme =
    getMasterGraphTheme();


  cy.style()

    .selector("node")
    .style({

      "background-color":
        graphTheme.nodeBackground,

      "border-color":
        graphTheme.nodeBorder,

      color:
        graphTheme.nodeText,

    })


    .selector("edge")
    .style({

      "line-color":
        graphTheme.edge,

      "target-arrow-color":
        graphTheme.edgeArrow,

    })


    .update();

}

function MasterGraph({
  notes,
  onOpenNote,
}) {
  const containerRef = useRef(null);
  const cyRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const noteEdges =
  buildNoteEdges(notes);

const noteNodes =
  assignGroupColors(
    notes.map((note) => ({
      data: {
        id: `note-${note.id}`,
        noteId: note.id,

        label:
          note.title?.trim() ||
          "Untitled Note",
      },
    })),

    noteEdges
  );

        const elements = [
        ...noteNodes,
        ...noteEdges,
        ];

    const graphTheme =
      getMasterGraphTheme();
    
    const cy = cytoscape({
      container: containerRef.current,
      elements,

      layout: {
        name: "cose",
        animate: true,
        padding: 80,
        nodeRepulsion: 900000,
        idealEdgeLength: 180,
        componentSpacing: 180,
        },

      style: [
        {
          selector: "node",
          style: {
            label: "data(label)",
            width: 150,
            height: 60,
            shape: "round-rectangle",
            "background-color":
            "data(groupColor)",
            "border-width": 2,
            "border-color":
              graphTheme.nodeBorder,
            color: graphTheme.nodeText,
            "text-valign": "center",
            "text-halign": "center",
            "text-wrap": "wrap",
            "text-max-width": "120px",
            "font-size": "15px",
          },
        },
        {
        selector: "edge",
        style: {
            width: 3,
            "line-color":
              graphTheme.edge,
            "target-arrow-color":
              graphTheme.edgeArrow,
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            opacity: 0.95,
        },
        },
      ],
    });

    cyRef.current = cy;

    /* =========================================================
      WATCH TREE NOTES THEME / ACCESSIBILITY CHANGES
      ========================================================= */

    const themeObserver =
      new MutationObserver(
        (mutations) => {

          const themeChanged =
            mutations.some(
              mutation =>
                mutation.attributeName ===
                  "data-theme" ||

                mutation.attributeName ===
                  "data-color-vision"
            );


          if (!themeChanged) {
            return;
          }


          applyMasterGraphTheme(
            cy
          );

        }
      );


    themeObserver.observe(
      document.documentElement,
      {
        attributes: true,

        attributeFilter: [
          "data-theme",
          "data-color-vision",
        ],
      }
    );

    cy.on(
      "dbltap",
      "node",
      (event) => {
        const noteId =
          event.target.data("noteId");

        onOpenNote(noteId);
      }
    );

    return () => {
      themeObserver.disconnect();
      cy.destroy();
      cyRef.current = null;
    };
  }, [notes, onOpenNote]);

  return (
    <section className="master-graph-page">
      <div className="master-graph-header">
        <h1>Note Connections</h1>

        <p>
          Explore connections across all your notes.
        </p>
      </div>

      <div
        ref={containerRef}
        className="master-graph-container"
      />
    </section>
  );
}

function buildNoteEdges(notes) {
  const edges = [];

  for (let i = 0; i < notes.length; i++) {
    for (let j = i + 1; j < notes.length; j++) {
      const noteA = notes[i];
      const noteB = notes[j];

      const textA = `${noteA.title || ""} ${noteA.raw_notes || ""} ${noteA.summary || ""}`
        .toLowerCase();

      const textB = `${noteB.title || ""} ${noteB.raw_notes || ""} ${noteB.summary || ""}`
        .toLowerCase();

      const wordsA = new Set(
        textA
          .split(/\W+/)
          .filter((word) => word.length > 3)
      );

      const wordsB = new Set(
        textB
          .split(/\W+/)
          .filter((word) => word.length > 3)
      );

      const sharedWords = [...wordsA].filter((word) =>
        wordsB.has(word)
      );

      if (sharedWords.length >= 1) {
        edges.push({
          data: {
            id: `edge-${noteA.id}-${noteB.id}`,
            source: `note-${noteA.id}`,
            target: `note-${noteB.id}`,
          },
        });
      }
    }
  }

  return edges;
}

export default MasterGraph;