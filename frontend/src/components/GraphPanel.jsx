import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from "react";
import {
  ChartLine, Shapes, Circle, RectangleHorizontal, Square, Squircle, SquareDashed, Diamond,
  Hexagon, Octagon, Triangle, Trash2, Link2, Sparkles, ChevronDown, ChevronRight, X, Check,
  CircleAlert, LoaderCircle, Search, Plus, ArrowUp, Type, PaintBucket, ImagePlus,
  Image as ImageIcon, MoveUpRight, Minus, ArrowRight, CircleX, Maximize2, Minimize2, Settings, Info,
} from "lucide-react";
import SquareDottedIcon from "./icons/SquareDottedIcon";
import VeeIcon from "./icons/VeeIcon";
import VeeNodeIcon from "./icons/VeeNodeIcon";
import FontColorIcon from "./icons/FontColorIcon";
import cytoscape from "cytoscape";
import { semanticSearchGraph } from "../api/graphApi";
import TreeNotesColorPicker from "./TreeNotesColorPicker";

/* =========================================================
   AI PROCESSING / INTERPRETABILITY PREVIEW
   ========================================================= */

/*
  Hans can override these by sending title/description in the
  stream event. These are friendly fallbacks for the minimal
  { step, content } form discussed for the pipeline.
*/

const AI_PROCESSING_STAGE_FALLBACKS = {
  1: {
    title: "Source text",
    description: "Read the original raw notes supplied to graph generation.",
  },
  2: {
    title: "Extract semantic units",
    description: "Identify candidate entities, actions, conditions, and outcomes.",
  },
  3: {
    title: "Resolve pronouns",
    description: "Resolve pronouns and references back to the concepts they describe.",
  },
  4: {
    title: "Distribute shared terms",
    description: "Apply shared subjects and objects to the propositions that inherit them.",
  },
  5: {
    title: "Resolve conditions",
    description: "Associate conditional phrases with the propositions they govern.",
  },
  6: {
    title: "Resolve relationships",
    description: "Determine proposition relationships and higher-order causal links.",
  },
  7: {
    title: "Classify graph semantics",
    description: "Assign qualifiers, classifications, and edge roles used by TreeNotes.",
  },
  8: {
    title: "Validate graph elements",
    description: "Check the extracted semantic structure before graph elements are emitted.",
  },
};
const AI_PROCESSING_MOCK_STEPS = [
  {
    step: 1,
    title: "Source text",
    description: AI_PROCESSING_STAGE_FALLBACKS[1].description,
    content: "When the sun rises, lizards bask on rocks, allowing lizards to gain energy.",
  },
  {
    step: 2,
    title: "Extract semantic units",
    description: AI_PROCESSING_STAGE_FALLBACKS[2].description,
    content: "Entities: Lizards, Rocks, Energy\nCondition: When the sun rises\nActions: bask on, gain\nHigher-order relation: allowing",
  },
  {
    step: 3,
    title: "Resolve pronouns",
    description: AI_PROCESSING_STAGE_FALLBACKS[3].description,
    content: "No unresolved pronouns found. Both propositions retain the subject ‘Lizards’.",
  },
  {
    step: 4,
    title: "Distribute shared terms",
    description: AI_PROCESSING_STAGE_FALLBACKS[4].description,
    content: "Shared subject ‘Lizards’ applied to both: ‘bask on Rocks’ and ‘gain Energy’.",
  },
  {
    step: 5,
    title: "Resolve conditions",
    description: AI_PROCESSING_STAGE_FALLBACKS[5].description,
    content: "‘When the sun rises’ governs both extracted propositions and is owned by ‘Lizards’.",
  },
  {
    step: 6,
    title: "Resolve relationships",
    description: AI_PROCESSING_STAGE_FALLBACKS[6].description,
    content: "Proposition A: Lizards — basks on → Rocks\nProposition B: Lizards — gains → Energy\nA allows B.",
  },
  {
    step: 7,
    title: "Classify graph semantics",
    description: AI_PROCESSING_STAGE_FALLBACKS[7].description,
    content: "Condition node: conditional, owner=Lizards\nProposition edges: standard\nALLOWS edge: reification\nNo qualifier or negative/affirmative classification detected.",
  },
];
const SHOW_AI_PROCESSING_MOCK = true;

/* =========================================================
   GRAPH THEME HELPERS
   ========================================================= */

/*
  Cytoscape does not automatically resolve CSS variables
  in the same way normal DOM CSS does.

  Read the active TreeNotes theme values from <html>
  and give Cytoscape the resolved colour.
*/

function getThemeColour(variableName, fallback) {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(variableName)
    .trim();
  return value || fallback;
}

function getGraphThemeColours() {
  return {
    nodeBackground: getThemeColour("--graph-node-bg", "#6366F1"),
    nodeBorder: getThemeColour("--graph-node-border", "#818CF8"),
    nodeText: getThemeColour("--graph-node-text", "#ffffff"),
    selectedBorder: getThemeColour("--graph-selected-border", "#41d19f"),
    selectedGlow: getThemeColour("--graph-selected-glow", "rgba(65, 209, 159, 0.28)"),
    edge: getThemeColour("--graph-edge", "#475569"),

    /*
      Use graph-link palette colour 2 for
      "first node selected while linking".
    */

    linkSource: getThemeColour("--graph-link-2", "#f2c94c"),
  };
}
const NODE_SHAPES = [
  {
    value: "ellipse",
    label: "Circle",
    Icon: Circle,
  },
  {
    value: "rectangle",
    label: "Rectangle",
    Icon: RectangleHorizontal,
  },
  {
    value: "round-rectangle",
    label: "Rounded",
    Icon: Squircle,
  },
  {
    value: "diamond",
    label: "Diamond",
    Icon: Diamond,
  },
  {
    value: "triangle",
    label: "Triangle",
    Icon: Triangle,
  },
  {
    value: "vee",
    label: "Vee",
    Icon: VeeNodeIcon,
  },
  {
    value: "hexagon",
    label: "Hexagon",
    Icon: Hexagon,
    rotation: 30,
  },
  {
    value: "octagon",
    label: "Octagon",
    Icon: Octagon,
  },
];
const NODE_BORDER_STYLES = [
  {
    value: "solid",
    label: "Solid border",
    Icon: Square,
  },
  {
    value: "dashed",
    label: "Dashed border",
    Icon: SquareDashed,
  },
  {
    value: "dotted",
    label: "Dotted border",
    Icon: SquareDottedIcon,
  },
];
const EDGE_STYLES = [
  {
    value: "solid",
    label: "Solid",
  },
  {
    value: "dashed",
    label: "Dashed",
  },
  {
    value: "dotted",
    label: "Dotted",
  },
];
const ARROW_SHAPES = [
  {
    value: "triangle",
    label: "Triangle",
    Icon: Triangle,
    rotation: 90,
  },
  {
    value: "vee",
    label: "Vee",
    Icon: VeeIcon,
    rotation: 135,
  },
  {
    value: "chevron",
    label: "Chevron",
    Icon: ChevronRight,
  },
  {
    value: "tee",
    label: "Tee",
    Icon: Minus,
    rotation: 90,
  },
  {
    value: "circle",
    label: "Circle",
    Icon: Circle,
  },
  {
    value: "square",
    label: "Square",
    Icon: Square,
  },
  {
    value: "diamond",
    label: "Diamond",
    Icon: Diamond,
  },
  {
    value: "none",
    label: "No arrow",
    Icon: CircleX,
  },
];

/* =========================================================
   SEMANTIC NODE / EDGE TYPES
   ========================================================= */

const NODE_TYPES = [
  { value: "standard", label: "Standard" },
  { value: "conditional", label: "Conditional" },
];
const EDGE_ROLES = [
  { value: "auto", label: "Auto-detect" },
  { value: "standard", label: "Standard" },
  { value: "reification", label: "Reification" },
];

/*
  Match the muted / pastel preset row in TreeNotesColorPicker.
  Start at the warm orange currently used by the first condition, then
  walk around the rest of the row before returning to the muted coral.
*/

const CONDITIONAL_NODE_MUTED_PALETTE = [
  "#FDBA74",
  "#FDE68A",
  "#BEF264",
  "#86EFAC",
  "#5EEAD4",
  "#7DD3FC",
  "#C4B5FD",
  "#FCA5A5",
];
const CONDITIONAL_NODE_DEFAULT_COLOR = CONDITIONAL_NODE_MUTED_PALETTE[0];
const CONDITIONAL_NODE_DEFAULT_TEXT_COLOR = "#171717";

function getThemeContrastColour() {
  const theme = String(document.documentElement.getAttribute("data-theme") || "").toLowerCase();
  if (theme.includes("light")) {
    return "#111111";
  }
  if (theme.includes("dark")) {
    return "#ffffff";
  }
  return window.matchMedia?.("(prefers-color-scheme: light)")?.matches ? "#111111" : "#ffffff";
}

function getConditionalDefaultBorderColour() {
  return getThemeContrastColour();
}

function getReadableTextColour(background) {
  const value = String(background || "")
    .trim()
    .replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(value)) {
    return "#ffffff";
  }
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  const luminance = (0.2126 * red +
    0.7152 * green +
    0.0722 * blue) /
    255;
  return luminance > 0.62 ? "#111827" : "#ffffff";
}

function normaliseNodeType(value, conditionOwnerId = "") {
  if (conditionOwnerId) {
    return "conditional";
  }
  return String(value || "standard").toLowerCase() === "conditional" ? "conditional" : "standard";
}

function normaliseEdgeRole(value, reificationFlag = false) {
  if (reificationFlag) {
    return "reification";
  }
  const cleanValue = String(value || "auto").toLowerCase();
  return ["auto", "standard", "reification"].includes(cleanValue) ? cleanValue : "auto";
}

function normaliseEdgeClassification(value) {
  const cleanValue = String(value || "")
    .trim()
    .toLowerCase();
  if (!cleanValue || ["normal", "standard", "none"].includes(cleanValue)) {
    return "normal";
  }
  if (["negative", "negation", "negated"].includes(cleanValue)) {
    return "negative";
  }
  if (["affirmative", "affirmation", "positive", "asserted"].includes(cleanValue)) {
    return "affirmative";
  }
  return cleanValue;
}

/*
  Automatic clock-like slots for conditions around their semantic owner.
  The first few favour the right/top/bottom side of the owner, while larger
  groups gradually use the remaining space instead of becoming one tall
  column. Users can drag any conditional afterwards to override its offset.
*/

const CONDITION_AUTO_PLACEMENT_SLOTS = [
  { x: 1, y: 0 },
  { x: 0.72, y: -0.72 },
  { x: 0.72, y: 0.72 },
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -0.72, y: -0.72 },
  { x: -0.72, y: 0.72 },
  { x: -1, y: 0 },
];

function normaliseIncomingNodeData(nodeData = {}) {
  const conditionOwnerId = String(nodeData.conditionOwnerId ?? nodeData.parentNodeId ?? "").trim();
  const nodeType = normaliseNodeType(nodeData.nodeType ?? (nodeData.isConditional === true ? "conditional"
      : "standard"), conditionOwnerId);
  return {
    ...nodeData,
    nodeType,
    ...(conditionOwnerId ? { conditionOwnerId } : {}),
  };
}

function normaliseEdgeAdjuncts(value) {
  const rawItems = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,;\n]+/)
      : [];

  return Array.from(new Set(rawItems
    .map(item => String(item ?? "").trim())
    .filter(Boolean)));
}

function normaliseIncomingEdgeData(edgeData = {}) {
  const reificationFlag = edgeData.isReification === true || edgeData.reification === true;
  const normalisedClassification = normaliseEdgeClassification(edgeData.classification);
  const conditionId = String(edgeData.conditionId ?? "").trim();
  const fromEdgeId = String(edgeData.fromEdgeId ?? "").trim();
  const toEdgeId = String(edgeData.toEdgeId ?? "").trim();
  const adjuncts = normaliseEdgeAdjuncts(edgeData.adjuncts ?? edgeData.adjunct ?? []);
  const normalised = {
    ...edgeData,
    relationship: String(edgeData.relationship ?? edgeData.label ?? "").trim(),
    qualifier: String(edgeData.qualifier ?? "").trim(),

    /*
      Store only the final TreeNotes vocabulary in graph data.
      Normal is represented by an empty string to match manual edges.
    */

    classification: normalisedClassification === "normal" ? "" : normalisedClassification,
    edgeRole: normaliseEdgeRole(edgeData.edgeRole, reificationFlag),
  };
  delete normalised.adjunct;
  if (adjuncts.length > 0) {
    normalised.adjuncts = adjuncts;
  } else {
    delete normalised.adjuncts;
  }
  if (conditionId) {
    normalised.conditionId = conditionId;
  } else {
    delete normalised.conditionId;
  }
  if (fromEdgeId) {
    normalised.fromEdgeId = fromEdgeId;
  } else {
    delete normalised.fromEdgeId;
  }
  if (toEdgeId) {
    normalised.toEdgeId = toEdgeId;
  } else {
    delete normalised.toEdgeId;
  }
  return normalised;
}

/*
  Hans may either send a reification relation as a standalone edge
  or attach it as data.relation on another streamed edge.  Expand the
  nested form here so Cytoscape still receives ordinary node-to-node edges.
*/

function expandIncomingEdgeData(edgeData = {}) {
  const relation = edgeData?.relation && typeof edgeData.relation === "object" ? edgeData.relation : null;
  const baseEdge = normaliseIncomingEdgeData({
    ...edgeData,
  });
  delete baseEdge.relation;
  const expanded = [baseEdge];
  if (relation && relation.source != null && relation.target != null) {
    expanded.push(normaliseIncomingEdgeData({
      ...relation,
      id: relation.id || `${baseEdge.id || "relation"}-reification`,
      relationship: relation.relationship ?? relation.label ?? "",
      edgeRole: relation.edgeRole || "reification",
      conditionId: relation.conditionId ?? baseEdge.conditionId ?? "",
    }));
  }
  return expanded;
}

/* =========================================================
   NODE AUTO-SIZING
   ========================================================= */

const NODE_MIN_WIDTH = 110;
const NODE_MIN_HEIGHT = 52;
const NODE_FONT_SIZE = 15;
const NODE_LINE_HEIGHT = 19;

/*
  Maximum width of the actual label text before
  Cytoscape wraps it onto another line.
*/

const NODE_TEXT_WRAP_WIDTH = 150;

/* =========================================================
   NODE IMAGE FILL
   ========================================================= */

/*
  Large clipboard screenshots and phone photos should never be
  stored directly inside graph_json. We accept a reasonably large
  source file, then resize/compress it before attaching it to a node.
*/

const NODE_IMAGE_ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);
const NODE_IMAGE_MAX_INPUT_BYTES = 5 * 1024 * 1024;

/*
  This is the compressed binary size before base64 expansion.
  Keeping it below ~450 KB leaves much more breathing room in the
  note PATCH request than storing the original clipboard image.
*/

const NODE_IMAGE_MAX_STORED_BYTES = 450 * 1024;
const NODE_IMAGE_MAX_SOURCE_DIMENSION = 1024;
const NODE_IMAGE_DEFAULT_POSITION_X = 50;
const NODE_IMAGE_DEFAULT_POSITION_Y = 50;
const NODE_IMAGE_PREVIEW_SCALE = 0.72;

/*
  Rectangle-style image nodes follow the picture's aspect ratio.
  Geometric nodes keep a stable square bounding box so the chosen
  Cytoscape shape remains visually intentional.
*/

const NODE_IMAGE_SIZE_PRESETS = {
  small: {
    rectMaxWidth: 220,
    rectMaxHeight: 180,
    rectMinWidth: 100,
    rectMinHeight: 80,
    geometricSize: 165,
  },
  medium: {
    rectMaxWidth: 280,
    rectMaxHeight: 220,
    rectMinWidth: 120,
    rectMinHeight: 90,
    geometricSize: 200,
  },
  large: {
    rectMaxWidth: 340,
    rectMaxHeight: 270,
    rectMinWidth: 150,
    rectMinHeight: 110,
    geometricSize: 240,
  },
};
const NODE_IMAGE_DEFAULT_SIZE = "medium";
const NODE_IMAGE_LABEL_GAP = 20;

/*
  Shapes have very different amounts of usable
  internal space.

  Rectangles can use almost their entire body.
  Diamond / triangle / vee need substantially more
  outer size to contain the same text comfortably.
*/

const NODE_SHAPE_SIZE_FACTORS = {
  rectangle: {
    width: 1,
    height: 1,
  },
  "round-rectangle": {
    width: 1,
    height: 1,
  },
  ellipse: {
    width: 1.2,
    height: 1.15,
  },
  diamond: {
    width: 1.6,
    height: 1.6,
  },
  triangle: {
    width: 1.8,
    height: 1.9,
  },
  vee: {
    width: 1.9,
    height: 1.9,
  },
  hexagon: {
    width: 1.2,
    height: 1.1,
  },
  octagon: {
    width: 1.15,
    height: 1.1,
  },
};

function calculateNodeSize(label, shape = "round-rectangle") {
  const cleanLabel = String(label || "New Node").trim();

  /*
    Canvas lets us measure approximately the same
    text dimensions Cytoscape is rendering.
  */

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  context.font = `500 ${NODE_FONT_SIZE}px Inter, system-ui, sans-serif`;
  const words = cleanLabel.split(/\s+/);
  const lines = [];
  let currentLine = "";

  /*
    Find the widest individual word.

    If one word is wider than our normal wrapping
    width, expand the node instead of cutting the word.
  */

  const longestWordWidth = Math.max(...words.map(word => context.measureText(word).width), 1);

  /*
    Normally wrap around 150px.

    A single long word is allowed to make the
    text area wider so it remains intact.
  */

  const effectiveWrapWidth = Math.max(NODE_TEXT_WRAP_WIDTH, longestWordWidth + 4);
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (context.measureText(testLine).width >
      effectiveWrapWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  const widestLine = Math.max(...lines.map(line => context.measureText(line).width), 1);
  const textHeight = Math.max(lines.length, 1) *
    NODE_LINE_HEIGHT;

  /*
    Normal breathing room around the text.
  */

  const paddedWidth = widestLine + 34;
  const paddedHeight = textHeight + 22;
  const factors = NODE_SHAPE_SIZE_FACTORS[shape] ?? NODE_SHAPE_SIZE_FACTORS["round-rectangle"];
  const width = Math.max(NODE_MIN_WIDTH, Math.ceil(paddedWidth *
    factors.width));
  const height = Math.max(NODE_MIN_HEIGHT, Math.ceil(paddedHeight *
    factors.height));

  /*
    Cytoscape centres labels using the node's
    bounding box.

    A triangle's visual centre sits lower than
    its bounding-box centre, so move only triangle
    labels downward proportionally to their height.
  */

  const textMarginY = shape === "triangle" ? Math.round(height * 0.12) : 0;
  return {
    width,
    height,
    textMaxWidth: Math.ceil(effectiveWrapWidth),
    textMarginY,
  };
}

function clampImagePosition(value) {
  return Math.min(100, Math.max(0, Number(value) || 0));
}

function getImagePositionPercent(value, fallback = 50) {
  const parsed = Number.parseFloat(String(value ?? "")
    .replace("%", ""));
  return Number.isFinite(parsed) ? clampImagePosition(parsed) : fallback;
}

function getNodeImagePreviewSize(imageWidth, imageHeight, shape, imageSize) {
  const { width, height, } = calculateImageNodeSize(imageWidth, imageHeight, shape, imageSize);
  return {
    width: Math.round(width *
      NODE_IMAGE_PREVIEW_SCALE),
    height: Math.round(height *
      NODE_IMAGE_PREVIEW_SCALE),
  };
}

function formatNodeImageBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 KB";
  }
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getClipboardImageFile(event) {
  const items = Array.from(event?.clipboardData?.items ?? []);
  const imageItem = items.find(item => item.kind === "file" && item.type?.startsWith("image/"));
  return imageItem?.getAsFile?.() ?? null;
}

function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("TreeNotes could not read the processed image."));
    reader.readAsDataURL(blob);
  });
}

function loadNodeImageSource(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("TreeNotes could not decode that image."));
    };
    image.src = objectUrl;
  });
}

function canvasToNodeImageBlob(canvas, quality) {
  return new Promise((resolve) => {
    canvas.toBlob(blob => resolve(blob), "image/webp", quality);
  });
}
async function processNodeImageFile(file) {
  if (!file) {
    throw new Error("No image was provided.");
  }
  if (!NODE_IMAGE_ALLOWED_TYPES.has(file.type)) {
    throw new Error("Node images must be PNG, JPEG, or WebP.");
  }
  if (file.size >
    NODE_IMAGE_MAX_INPUT_BYTES) {
    throw new Error(`That image is ${formatNodeImageBytes(file.size)}. The maximum source size is ${formatNodeImageBytes(NODE_IMAGE_MAX_INPUT_BYTES)}.`);
  }
  const sourceImage = await loadNodeImageSource(file);
  const originalWidth = sourceImage.naturalWidth || sourceImage.width;
  const originalHeight = sourceImage.naturalHeight || sourceImage.height;
  if (!Number.isFinite(originalWidth) || !Number.isFinite(originalHeight) || originalWidth <= 0 ||
    originalHeight <= 0) {
    throw new Error("TreeNotes could not determine the image dimensions.");
  }
  const initialScale = Math.min(1, NODE_IMAGE_MAX_SOURCE_DIMENSION /
    Math.max(originalWidth, originalHeight));
  let targetWidth = Math.max(1, Math.round(originalWidth *
    initialScale));
  let targetHeight = Math.max(1, Math.round(originalHeight *
    initialScale));
  let bestBlob = null;
  let bestWidth = targetWidth;
  let bestHeight = targetHeight;
  const qualitySteps = [
    0.86,
    0.78,
    0.70,
    0.62,
    0.54,
  ];

  /*
    Try a few quality levels first. If a very detailed screenshot is
    still too large, reduce dimensions and repeat. At node scale this
    remains far sharper than storing a tiny thumbnail.
  */

  for (let resizePass = 0; resizePass < 8; resizePass += 1) {
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("This browser could not prepare the node image.");
    }
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(sourceImage, 0, 0, targetWidth, targetHeight);
    for (const quality of qualitySteps) {
      const blob = await canvasToNodeImageBlob(canvas, quality);
      if (!blob) {
        continue;
      }
      if (!bestBlob || blob.size < bestBlob.size) {
        bestBlob = blob;
        bestWidth = targetWidth;
        bestHeight = targetHeight;
      }
      if (blob.size <= NODE_IMAGE_MAX_STORED_BYTES) {
        return {
          dataUrl: await readBlobAsDataUrl(blob),
          mime: blob.type || "image/webp",
          width: targetWidth,
          height: targetHeight,
          originalWidth,
          originalHeight,
          storedBytes: blob.size,
        };
      }
    }
    targetWidth = Math.max(1, Math.round(targetWidth * 0.82));
    targetHeight = Math.max(1, Math.round(targetHeight * 0.82));
  }
  if (bestBlob && bestBlob.size <= NODE_IMAGE_MAX_STORED_BYTES) {
    return {
      dataUrl: await readBlobAsDataUrl(bestBlob),
      mime: bestBlob.type || "image/webp",
      width: bestWidth,
      height: bestHeight,
      originalWidth,
      originalHeight,
      storedBytes: bestBlob.size,
    };
  }
  throw new Error(`TreeNotes could not compress that image below ${formatNodeImageBytes(NODE_IMAGE_MAX_STORED_BYTES)}. Try a smaller image.`);
}

function calculateImageNodeSize(imageWidth, imageHeight, shape, imageSize = NODE_IMAGE_DEFAULT_SIZE) {
  const safeWidth = Math.max(1, Number(imageWidth) || 1);
  const safeHeight = Math.max(1, Number(imageHeight) || 1);
  const isRectangleShape = shape === "rectangle" || shape === "round-rectangle";
  const preset = NODE_IMAGE_SIZE_PRESETS[imageSize] || NODE_IMAGE_SIZE_PRESETS[NODE_IMAGE_DEFAULT_SIZE];
  let width;
  let height;
  if (isRectangleShape) {
    const scale = Math.min(preset.rectMaxWidth /
      safeWidth, preset.rectMaxHeight /
    safeHeight);
    width = Math.max(preset.rectMinWidth, Math.round(safeWidth * scale));
    height = Math.max(preset.rectMinHeight, Math.round(safeHeight * scale));
  } else {
    width = preset.geometricSize;
    height = preset.geometricSize;
  }
  return {
    width,
    height,

    /*
      The node name stays visible below the picture. Keeping this
      width independent of very narrow portrait images prevents
      labels from wrapping into a tall column.
    */

    textMaxWidth: Math.max(150, Math.min(220, width)),

    /*
      Existing rename-overlay maths already honours nodeTextMarginY.
      Moving the normal centred label by half the image-node height
      plus a gap places it neatly underneath the picture.
    */

    textMarginY: Math.round(height / 2 +
      NODE_IMAGE_LABEL_GAP),
  };
}

function getNodeImagePreviewClipPath(shape) {
  switch (shape) {
    case "ellipse":
      return "circle(50% at 50% 50%)";
    case "diamond":
      return "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)";
    case "triangle":
      return "polygon(50% 0%, 100% 100%, 0% 100%)";
    case "vee":
      return "polygon(0% 0%, 50% 100%, 100% 0%, 72% 0%, 50% 58%, 28% 0%)";
    case "hexagon":
      return "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)";
    case "octagon":
      return "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)";
    default:
      return "none";
  }
}

function getThemeToken(tokenName, fallback) {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(tokenName)
    .trim();
  return value || fallback;
}

function getGraphThemeTokens() {
  return {
    nodeBg: getThemeToken("--graph-node-bg", "#6366f1"),
    nodeBorder: getThemeToken("--graph-node-border", "#7772ff"),
    nodeText: getThemeToken("--graph-node-text", "#ffffff"),
    selectedBorder: getThemeToken("--graph-selected-border", "#4fd1a1"),
    selectedGlow: getThemeToken("--graph-selected-glow", "rgba(79, 209, 161, 0.28)"),
    selectedEdge: getThemeToken("--graph-selected-edge", "#4fd1a1"),
    linkSource: getThemeToken("--graph-link-source", "#f2c94c"),
    linkSourceGlow: getThemeToken("--graph-link-source-glow", "rgba(242, 201, 76, 0.28)"),
    edge: getThemeToken("--graph-edge", "#465873"),
    edgeArrow: getThemeToken("--graph-edge-arrow", "#7772ff"),
    edgeLabel: getThemeToken("--graph-edge-label", "#cbd5e1"),
    adjunctLabel: getThemeToken("--text-accent", "#aaa6ff"),
    negativeMark: getThemeToken("--status-error", "#ef4444"),
    affirmativeMark: getThemeToken("--status-success", "#22c55e"),
  };
}

function GraphPropertyDropdown({ value, options = [], placeholder = "Select...", isOpen, onToggle, onSelect, searchable = false, searchValue = "", onSearchChange, searchPlaceholder = "Search graph nodes...", emptyMessage = "No matching options", ariaLabel, }) {
  const selectedOption = options.find(option => String(option.value ?? option.id) === String(value ?? "")) || null;
  const query = String(searchValue || "")
    .trim()
    .toLowerCase();
  const filteredOptions = searchable && query ? options.filter(option => String(option.label || "")
      .toLowerCase()
      .includes(query)) : options;
  return (<div className={`graph-property-dropdown ${searchable ? "graph-property-dropdown-searchable" : ""}`}>
    <button type="button" className={`graph-property-dropdown-trigger ${isOpen
      ? "graph-property-dropdown-trigger-open"
      : ""}`} onClick={onToggle} aria-haspopup="listbox" aria-expanded={isOpen} aria-label={ariaLabel}>
      <span className={`graph-property-dropdown-trigger-label ${selectedOption
        ? "" : "is-placeholder"}`}>
        {selectedOption?.label || placeholder}
      </span>

      <ChevronDown className={`graph-property-dropdown-chevron ${isOpen
        ? "graph-property-dropdown-chevron-open" : ""}`} size={15} strokeWidth={1.9} />
    </button>

    {isOpen && (<div className="graph-property-dropdown-menu" role="listbox">
      {searchable && (<div className="graph-property-dropdown-search-wrap">
        <Search size={13} strokeWidth={1.8} aria-hidden="true" />

        <input type="text" className="graph-property-dropdown-search" value={searchValue} onChange={(event) => onSearchChange?.(event.target.value)} placeholder={searchPlaceholder} autoFocus />
      </div>)}

      <div className="graph-property-dropdown-options">
        {filteredOptions.length > 0 ? (filteredOptions.map(option => {
          const optionValue = String(option.value ?? option.id ?? "");
          const selected = optionValue === String(value ?? "");
          return (<button type="button" key={optionValue} className={`graph-property-dropdown-option ${selected
            ? "graph-property-dropdown-option-selected"
            : ""}`} role="option" aria-selected={selected} onClick={() => onSelect(optionValue)}>
            <span>
              {option.label}
            </span>

            {selected && (<Check size={13} strokeWidth={2} />)}
          </button>);
        })) : (<div className="graph-property-dropdown-empty">
          {emptyMessage}
        </div>)}
      </div>
    </div>)}
  </div>);
}

function GraphSegmentedControl({ label, value, options = [], onChange, statusText, ariaLabel, }) {
  const selectedOption = options.find(option => String(option.value) === String(value)) || null;
  return (<div className="graph-image-control graph-property-segmented-control">
    <div className="graph-image-control-heading">
      <span>{label}</span>

      <span>
        {statusText || selectedOption?.label || ""}
      </span>
    </div>

    <div className="graph-image-segmented graph-property-segmented" role="group" aria-label={ariaLabel || label}>
      {options.map(option => (<button key={option.value} type="button" className={String(value) === String(option.value)
        ? "active" : ""} aria-pressed={String(value) === String(option.value)} onClick={() => onChange(option.value)}>
        {option.label}
      </button>))}
    </div>
  </div>);
}
const GraphPanel = forwardRef(function GraphPanel({ rawNotes, selectedText, addNodeTrigger, noteId, initialGraph, onNavigateLinkedText, isFocused = false, onToggleFocus, }, ref) {
  // << frontend dev >> //
  // Stores graph JSON returned from AI/backend/database //

  /*
    Always initialise GraphPanel with a valid graph object.

    If this note already has a graph_json value from the
    database, use it immediately. Otherwise keep a real empty
    graph so users can manually create nodes before pressing
    Generate Graph.
  */

  const [graphData, setGraphData] = useState(() => ({
    nodes: Array.isArray(initialGraph?.nodes) ? initialGraph.nodes : [],
    edges: Array.isArray(initialGraph?.edges) ? initialGraph.edges : [],
  }));
  // Handles graph loading state //
  const [loading, setLoading] = useState(false);
  // Handles graph generation errors //
  const [error, setError] = useState("");
  // References the HTML div where Cytoscape renders //
  const graphContainerRef = useRef(null);
  // References the Graph Editor container for focus management //
  const graphEditorRef = useRef(null);
  const [graphEditorActive, setGraphEditorActive] = useState(false);
  const loadedGraphNoteIdRef = useRef(null);
  // Stores the Cytoscape instance so other functions can access it //
  const cyRef = useRef(null);
  // =========================================================
  // AI GRAPH STREAMING
  // =========================================================
  // Holds streamed edges whose source/target nodes
  // have not arrived yet.
  const pendingStreamEdgesRef = useRef([]);
  // =========================================================
  // STREAM VISUAL POSITIONING
  // =========================================================
  // Temporary centre around which streamed nodes are placed.
  // The final COSE layout will replace these positions.
  const streamAnchorRef = useRef(null);
  // Counts nodes as they arrive so temporary positions
  // can be distributed around the graph canvas.
  const streamNodeIndexRef = useRef(0);
  // =========================================================
  // GRAPH STREAM REQUEST
  // =========================================================
  // Stores the currently active graph-generation request.
  // Allows us to cancel it if the note changes or the
  // component disappears.
  const graphStreamAbortRef = useRef(null);
  // =========================================================
  // EDGE LINKING
  // =========================================================
  // Stores selected edge states
  const [selectedEdge, setSelectedEdge] = useState(null);
  const linkModeRef = useRef(false);
  const firstNodeToLinkRef = useRef(null);
  // Stores currently selected node //
  const [selectedNode, setSelectedNode] = useState(null);
  // Stores an array of selected nodes/edges for multi-selection //
  const [selectionSummary, setSelectionSummary,] = useState({
    nodes: [],
    edges: [],
  });
  // To link nodes//
  const [linkMode, setLinkMode] = useState(false);
  // TO save first node clicked to link to second //
  const [firstNodeToLink, setFirstNodeToLink] = useState(null);
  // =========================================================
  // Node Image Preview Dragging Position
  // =========================================================
  const imagePreviewDragRef = useRef(null);
  const [imagePreviewDragging, setImagePreviewDragging] = useState(false);
  // =========================================================
  // Graph Toolbar
  // =========================================================
  // Hidden native colour picker
  // const nodeColorInputRef = useRef(null);
  // color picker for node text
  // const nodeTextColorInputRef = useRef(null);
  // Node border colour picker
  // const nodeBorderColorInputRef = useRef(null);
  // Node image fill controls
  const nodeImageInputRef = useRef(null);
  const nodeImageTargetIdRef = useRef(null);
  const [nodeImageModalOpen, setNodeImageModalOpen] = useState(false);
  // Node border style popover
  const nodeBorderStyleMenuRef = useRef(null);
  const [nodeBorderStyleMenuOpen, setNodeBorderStyleMenuOpen] = useState(false);
  // Shape selector popover
  const shapeMenuRef = useRef(null);
  const [shapeMenuOpen, setShapeMenuOpen] = useState(false);
  // Custom graph colour pickers
  const nodeColorButtonRef = useRef(null);
  const nodeTextColorButtonRef = useRef(null);
  const nodeBorderColorButtonRef = useRef(null);
  const edgeColorButtonRef = useRef(null);
  const arrowColorButtonRef = useRef(null);
  const [graphColorPicker, setGraphColorPicker] = useState(null);

  function toggleGraphColorPicker(type) {
    setShapeMenuOpen(false);
    setNodeBorderStyleMenuOpen(false);
    setEdgeStyleMenuOpen(false);
    setArrowShapeMenuOpen(false);
    setGraphColorPicker(current => current === type ? null : type);
  }
  // Edge style selector popover
  const edgeStyleMenuRef = useRef(null);
  const [edgeStyleMenuOpen, setEdgeStyleMenuOpen] = useState(false);
  // Arrow shape selector popover
  const arrowShapeMenuRef = useRef(null);
  const [arrowShapeMenuOpen, setArrowShapeMenuOpen] = useState(false);
  // Generic temporary feedback for graph actions
  const [graphFeedback, setGraphFeedback] = useState(null);
  // Used to clear graph feedback automatically
  const graphFeedbackTimerRef = useRef(null);
  // =========================================================
  // Graph Semantic Search
  // =========================================================
  const [semanticSearchOpen, setSemanticSearchOpen] = useState(false);
  const [semanticSearchQuery, setSemanticSearchQuery] = useState("");
  const [semanticSearchLoading, setSemanticSearchLoading] = useState(false);
  const semanticSearchRef = useRef(null);
  // =========================================================
  // Node Rename
  // =========================================================
  const [editingNodeId, setEditingNodeId] = useState(null);
  const editingNodeIdRef = useRef(null);
  const [renameValue, setRenameValue] = useState("");
  const renameOriginalValueRef = useRef("");
  const [renamePosition, setRenamePosition] = useState({
    x: 0,
    y: 0,
  });
  const [renameZoom, setRenameZoom] = useState(1);
  // =========================================================
  // Edge Relationship Editing
  // =========================================================
  const [editingEdgeId, setEditingEdgeId] = useState(null);
  const editingEdgeIdRef = useRef(null);
  const [relationshipValue, setRelationshipValue] = useState("");
  const relationshipOriginalValueRef = useRef("");
  const [relationshipPosition, setRelationshipPosition] = useState({
    x: 0,
    y: 0,
  });
  const [relationshipZoom, setRelationshipZoom] = useState(1);
  // =========================================================
  // NODE / EDGE SEMANTIC PROPERTIES
  // =========================================================
  const [nodePropertiesModalOpen, setNodePropertiesModalOpen] = useState(false);
  const [nodePropertiesDraft, setNodePropertiesDraft] = useState({
    nodeId: "",
    nodeType: "standard",
    conditionOwnerId: "",
  });
  const [edgePropertiesModalOpen, setEdgePropertiesModalOpen] = useState(false);
  const [edgePropertiesDraft, setEdgePropertiesDraft] = useState({
    edgeId: "",
    relationship: "",
    qualifier: "",
    adjunctsText: "",
    classification: "",
    edgeRole: "auto",
    conditionId: "",
  });
  const [propertyDropdownOpen, setPropertyDropdownOpen] = useState(null);
  const [nodeOwnerSearch, setNodeOwnerSearch] = useState("");
  const [edgeConditionSearch, setEdgeConditionSearch] = useState("");
  // =========================================================
  // Node Auto-Sizing / Edge Label Refresh
  // =========================================================
  function resizeNodeToLabel(node) {
    if (!node || node.empty()) {
      return;
    }
    const label = node.data("label") || "New Node";
    const shape = node.data("shape") || "round-rectangle";
    const imageSrc = node.data("imageSrc");

    /*
      Image-filled nodes are sized from the picture rather than the
      label. Rectangle variants preserve image aspect ratio, while
      geometric shapes keep a stable body and crop with cover.
    */

    if (imageSrc) {
      const { width, height, textMaxWidth, textMarginY, } = calculateImageNodeSize(node.data("imageWidth"), node.data("imageHeight"), shape, node.data("imageSize") ||
        NODE_IMAGE_DEFAULT_SIZE);
      node.data({
        nodeWidth: width,
        nodeHeight: height,
        nodeTextMaxWidth: textMaxWidth,
        nodeTextMarginY: textMarginY,
      });
      refreshConnectedEdgeLabels(node);
      return;
    }
    const { width, height, textMaxWidth, textMarginY, } = calculateNodeSize(label, shape);

    /*
      Keep these as node data so the Cytoscape
      stylesheet can consume them automatically.
    */

    node.data({
      nodeWidth: width,
      nodeHeight: height,
      nodeTextMaxWidth: textMaxWidth,
      nodeTextMarginY: textMarginY,
    });
    refreshConnectedEdgeLabels(node);
  }

  function syncImageNodePresentation(node) {
    if (!node || node.empty()) {
      return;
    }
    const shouldHideLabel = Boolean(node.data("imageSrc")) && node.data("showImageLabel") === false;
    if (shouldHideLabel) {
      node.addClass("image-label-hidden");
    } else {
      node.removeClass("image-label-hidden");
    }
  }

  function applyEdgeRoute(edge, curved, distance = 0) {
    edge.removeStyle("curve-style control-point-distances control-point-weights");

    edge.data("parallelRoute", curved ? "curved" : "straight");
    edge.data("curveDistance", distance);

    if (curved) {
      edge.style({"curve-style": "unbundled-bezier", "control-point-distances": distance, "control-point-weights": 0.5});
    } else {
      edge.style({"curve-style": "straight"});
    }
  }

  function syncParallelEdgeRouting(cy) {
    if (!cy) {
      return;
    }

    /*
      Only real semantic edges participate in collision detection.

      Annotation edges must NOT count as parallel edges themselves,
      otherwise every edge with a qualifier/check/etc would appear
      to have several parallel connections.
    */

    const semanticEdges = cy.edges().filter((edge) => {
      return (!edge.data("graphInternal") && !isInternalConditionOwnerEdge(edge));
    });

    const groups = new Map();

    semanticEdges.forEach((edge) => {
      const sourceId = edge.source().id();
      const targetId = edge.target().id();
      const canonicalSource = sourceId < targetId ? sourceId : targetId;
      const canonicalTarget = sourceId < targetId ? targetId : sourceId;
      const key = `${canonicalSource}::${canonicalTarget}`;
      if (!groups.has(key)) {
        groups.set(key, {sourceId: canonicalSource, targetId: canonicalTarget, edges: []});
      }

      groups.get(key).edges.push(edge);
    });

    /*
      Reset everything first.
    */

    semanticEdges.forEach((edge) => {
      edge.data({parallelGroupSize: 1, parallelSlot: 0});
      applyEdgeRoute(edge, false, 0);
    });

    /*
      Only groups containing multiple semantic edges curve.
    */

    groups.forEach((group) => {
      const edges = [...group.edges].sort((a, b) =>
        a.id().localeCompare(b.id())
      );

      if (edges.length < 2) {
        return;
      }

      /*
        Work out how annotation-heavy this set of parallel edges is.

        Internal annotation edges include things such as:
          - qualifier
          - adjunct
          - affirmative / negative classification marker

        More annotation detail means we give the parallel curves
        a little more physical separation.
      */
      const getAnnotationCount = (semanticEdge) => {
        return cy
          .edges("[graphInternal]")
          .filter(
            (annotation) =>
              annotation.data("semanticEdgeId") === semanticEdge.id()
          )
          .length;
      };

      const maxAnnotationCount = Math.max(
        0,
        ...edges.map((edge) => getAnnotationCount(edge))
      );

      /*
        Base spacing is wider than before.

        Simple pair:
          ~64px total spacing calculation

        Annotation-heavy pair:
          can rise toward ~88px.

        We cap it so a busy relationship does not become an enormous bow.
      */
      const baseSpacing = 64;
      const annotationBonus = Math.max(0, maxAnnotationCount - 1) * 8;
      const spacing = Math.min(88, baseSpacing + annotationBonus);
      const centre = (edges.length - 1) / 2;

      edges.forEach((edge, index) => {
        const parallelSlot = index - centre;
        edge.data({parallelGroupSize: edges.length, parallelSlot});
        const physicalOffset = (index - centre) * spacing;

        /*
          Because reversing source/target reverses the edge's normal,
          compensate so A -> B and B -> A appear on opposite physical
          sides rather than collapsing onto each other.
        */
        const directionSign =
          edge.source().id() === group.sourceId
            ? 1
            : -1;
        const distance = physicalOffset * directionSign;
        if (Math.abs(distance) < 1) {
          applyEdgeRoute(edge, false, 0);
        } else {
          applyEdgeRoute(edge, true, distance);
        }
      });
    });

    /*
      Critical part:
      qualifier, adjunct, affirmative/negative marker and any other
      internal annotation edge must use EXACTLY the same route as
      its semantic parent.
    */

    cy.edges("[graphInternal]").forEach((annotation) => {
      const semanticEdgeId = annotation.data("semanticEdgeId");
      if (!semanticEdgeId) {
        return;
      }
      const semanticEdge = cy.getElementById(semanticEdgeId);
      if (!semanticEdge || semanticEdge.empty()) {
        return;
      }
      const curved = semanticEdge.data("parallelRoute") === "curved";
      const distance = Number(semanticEdge.data("curveDistance") || 0);
      applyEdgeRoute(annotation, curved, distance);
    });
  }

  function refreshConnectedEdgeLabels(node) {
    if (!node || node.empty()) {
      return;
    }
    const cy = node.cy();
    const connectedEdges = node.connectedEdges()
      .filter(edge => String(edge.data("relationship") || "").trim());
    if (connectedEdges.length === 0) {
      return;
    }

    /*
      First allow Cytoscape to finish applying
      the node's new width / height.
    */

    requestAnimationFrame(() => {

      /*
        Then give the renderer one more frame to
        recalculate the new edge endpoints.
      */

      requestAnimationFrame(() => {
        connectedEdges.forEach(edge => {
          const displayLabel = edge.data("displayLabel") || edge.data("relationship") || "";

          /*
            Force Cytoscape to rebuild the label's
            rendered bounding box.

            The zero-width character changes the
            underlying label value without creating
            any visible change on screen.
          */

          edge.style("label", `${displayLabel}\u200B`);
        });

        /*
          On the following frame, remove the temporary
          style override so the edge returns to using:

            label: data(displayLabel)

          from the normal Cytoscape stylesheet.
        */

        requestAnimationFrame(() => {
          connectedEdges.forEach(edge => {
            edge.removeStyle("label");
            if (edge.id() !== editingEdgeIdRef.current) {
              edge.style("text-opacity", 1);
            }
          });
          cy.style()
            .update();
        });
      });
    });
  }

  /*
    Keep GraphPanel synced with the graph_json belonging to the
    currently selected note.

    Important: an unsaved/empty graph remains { nodes: [], edges: [] }
    rather than null. That keeps Cytoscape alive so manual graph
    creation still works before Generate Graph is used.
  */

  useEffect(() => {

    /*
      A successful Save replaces the note object and therefore
      gives us a new initialGraph reference.

      Do NOT reload Cytoscape just because the same note was
      saved. The live Cytoscape graph is already authoritative.
    */

    if (loadedGraphNoteIdRef.current === noteId) {
      return;
    }
    loadedGraphNoteIdRef.current = noteId;
    setGraphData({
      nodes: Array.isArray(initialGraph?.nodes) ? initialGraph.nodes : [],
      edges: Array.isArray(initialGraph?.edges) ? initialGraph.edges : [],
    });
    // Clear UI state that belonged to the previously open note.
    setSelectedNode(null);
    setSelectedEdge(null);
    setSelectionSummary({
      nodes: [],
      edges: [],
    });
    setShapeMenuOpen(false);
    setNodeBorderStyleMenuOpen(false);
    setEdgeStyleMenuOpen(false);
    setArrowShapeMenuOpen(false);
    setGraphColorPicker(null);
    setGraphFeedback(null);
    setNodeImageModalOpen(false);
    setNodePropertiesModalOpen(false);
    setEdgePropertiesModalOpen(false);
    nodeImageTargetIdRef.current = null;
    // Clear UI state and references belonging to linking mode.
    linkModeRef.current = false;
    firstNodeToLinkRef.current = null;
    setLinkMode(false);
    setFirstNodeToLink(null);
    // Clear UI state belonging to previous editing node and edge.
    editingNodeIdRef.current = null;
    setEditingNodeId(null);
    editingEdgeIdRef.current = null;
    setEditingEdgeId(null);
    setRelationshipValue("");
  }, [noteId, initialGraph]);

  /* =========================================================
   CANCEL AI GRAPH STREAM WHEN NOTE CHANGES / PANEL UNMOUNTS
   ========================================================= */

  useEffect(() => {

    /*
      This cleanup runs:

        - before noteId changes
        - when GraphPanel is unmounted

      If an AI graph is still being streamed, abort that
      HTTP request so it cannot continue feeding graph data
      into a different note.
    */

    return () => {
      if (graphStreamAbortRef.current) {
        graphStreamAbortRef.current.abort();
      }
    };
  }, [noteId]);
  async function generateGraph() {
    if (!rawNotes || rawNotes.trim() === "") {
      setError("Please write some notes before generating a graph.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/graph", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          rawNotes: rawNotes,
        }),
      });

      let data = {};

      try {
        data = await response.json();
      } catch {
        // Leave data empty so the fallback error below can be used.
      }

      if (!response.ok) {
        let message =
          "Graph generation failed. Please try again.";

        if (typeof data?.detail === "string") {
          message = data.detail;
        } else if (Array.isArray(data?.detail)) {
          message = data.detail
            .map((item) =>
              String(item.msg).replace(
                /^Value error, /,
                ""
              )
            )
            .join(" ");
        }

        throw new Error(message);
      }

      /*
        Replace the current graph with the completed
        graph returned by the backend.
      */
      setGraphData({
        nodes: Array.isArray(data?.nodes)
          ? data.nodes
          : [],
        edges: Array.isArray(data?.edges)
          ? data.edges
          : [],
      });

    } catch (error) {
      console.error(
        "Graph generation error:",
        error
      );

      setError(
        error.message ||
          "Unable to generate graph. Please try again."
      );

    } finally {
      setLoading(false);
    }
  }

  /* =========================================================
     CONDITIONAL / REIFICATION GRAPH HELPERS
     ========================================================= */

  function isInternalConditionOwnerEdge(edge) {
    return (edge?.data?.("graphInternal") === "condition-owner");
  }

  function getConditionalNodes(cy = cyRef.current) {
    if (!cy) {
      return [];
    }
    return cy.nodes().filter(node => normaliseNodeType(node.data("nodeType"), node.data("conditionOwnerId")) === "conditional");
  }

  function getConditionalNodeColour(node) {
    if (!node || node.empty()) {
      return CONDITIONAL_NODE_DEFAULT_COLOR;
    }
    return (node.data("conditionColor") || node.data("color") || CONDITIONAL_NODE_DEFAULT_COLOR);
  }

  function getNextConditionalPaletteColour(cy = cyRef.current, excludeNodeId = "") {
    if (!cy) {
      return CONDITIONAL_NODE_DEFAULT_COLOR;
    }
    const conditionalCount = cy.nodes()
      .filter(node => !node.data("graphInternal") && node.id() !== excludeNodeId &&
        normaliseNodeType(node.data("nodeType"), node.data("conditionOwnerId")) === "conditional")
      .length;
    return CONDITIONAL_NODE_MUTED_PALETTE[conditionalCount %
      CONDITIONAL_NODE_MUTED_PALETTE.length];
  }

  function syncConditionalDefaultBorders(cy = cyRef.current) {
    if (!cy) {
      return;
    }
    const defaultBorder = getConditionalDefaultBorderColour();
    getConditionalNodes(cy).forEach(node => {
      if (node.data("conditionBorderAuto") === true) {
        node.data("borderColor", defaultBorder);
      }
    });
  }

  function syncImageNodeDefaultTextColours(cy = cyRef.current) {
    if (!cy) {
      return;
    }
    const defaultTextColour = getThemeContrastColour();
    const automaticColourCandidates = new Set([
      "#ffffff",
      "#fff",
      "#111111",
      "#111",
      "#000000",
      "#000",
      String(getThemeColour("--graph-node-text", defaultTextColour) || "").toLowerCase(),
    ]);
    cy.nodes()
      .filter(node => Boolean(node.data("imageSrc")) && !node.data("graphInternal"))
      .forEach(node => {
        if (node.data("textColorUserSet") === true) {
          return;
        }

        /*
          Older saved graphs predate textColorUserSet. Preserve an
          obviously custom colour, but treat the normal white/black
          defaults as automatic so existing picture nodes migrate cleanly.
        */

        const currentTextColour = String(node.data("textColor") || "")
          .trim()
          .toLowerCase();
        if (currentTextColour && !automaticColourCandidates.has(currentTextColour)) {
          node.data("textColorUserSet", true);
          return;
        }
        node.data("textColor", defaultTextColour);
      });
  }

  function measureEdgeLabelHalfWidth(text, fontSize = 12) {
    const cleanText = String(text || "").trim();
    if (!cleanText) {
      return 0;
    }
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) {
      return cleanText.length *
        fontSize * 0.28;
    }
    context.font = `500 ${fontSize}px Inter, system-ui, sans-serif`;
    return context.measureText(cleanText).width / 2;
  }

  function getEdgeCrowdingLaneMap(cy = cyRef.current) {
    const laneMap = new Map();
    if (!cy) {
      return laneMap;
    }

    /*
      Edge labels are painted at the midpoint of their edges. Around a busy
      node several similarly angled edges can therefore place relationship,
      qualifier and adjunct text into almost the same little corridor.

      Detect those small angular bundles and give neighbouring edges slightly
      different label lanes. This changes presentation only, never topology.
    */

    cy.nodes()
      .filter(node => node.visible() && !node.data("graphInternal"))
      .forEach(node => {
        const nodePosition = node.position();
        const incident = node.connectedEdges()
          .filter(edge => edge.visible() && !edge.data("graphInternal"))
          .toArray()
          .map(edge => {
            const other = edge.source().id() === node.id() ? edge.target() : edge.source();
            const otherPosition = other.position();
            return {
              edge,
              angle: Math.atan2(
                otherPosition.y - nodePosition.y,
                otherPosition.x - nodePosition.x
              ),
            };
          })
          .sort((first, second) => first.angle - second.angle);

        if (incident.length < 2) {
          return;
        }

        const groups = [];
        let currentGroup = [incident[0]];
        const angularThreshold = 0.34; // about 19 degrees

        for (let index = 1; index < incident.length; index += 1) {
          if (incident[index].angle - incident[index - 1].angle <= angularThreshold) {
            currentGroup.push(incident[index]);
          } else {
            groups.push(currentGroup);
            currentGroup = [incident[index]];
          }
        }
        groups.push(currentGroup);

        groups.forEach(group => {
          if (group.length < 2) {
            return;
          }

          group.forEach((item, index) => {
            const currentLane = laneMap.get(item.edge.id()) || 0;
            laneMap.set(item.edge.id(), Math.max(currentLane, index));
          });
        });
      });

    return laneMap;
  }

  function syncEdgeLabelGeometry(cy = cyRef.current) {
    if (!cy) {
      return;
    }

    const crowdingLaneMap = getEdgeCrowdingLaneMap(cy);

    cy.edges()
      .filter(edge => !edge.data("graphInternal"))
      .forEach(edge => {
        const sourcePosition = edge.source().position();
        const targetPosition = edge.target().position();
        const deltaX = targetPosition.x - sourcePosition.x;
        const deltaY = targetPosition.y - sourcePosition.y;
        const isCurved = edge.data("parallelRoute") === "curved";
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);
        const edgeLength = Math.max(1, Math.hypot(deltaX, deltaY));
        const isVertical = absY > 30 && absX <= Math.max(24, absY * 0.18);
        const classification = normaliseEdgeClassification(edge.data("classification"));
        const relationship = String(edge.data("displayLabel") || edge.data("relationship") || "");
        const qualifier = String(edge.data("qualifier") || "");
        const adjunctText = normaliseEdgeAdjuncts(edge.data("adjuncts")).join(" · ");
        const hasQualifier = Boolean(qualifier.trim());
        const hasAdjuncts = Boolean(adjunctText);
        const crowdLane = crowdingLaneMap.get(edge.id()) || 0;
        const parallelGroupSize = Number(edge.data("parallelGroupSize") || 1);
        const isParallelGroup = parallelGroupSize > 1;

        /*
          Parallel edges already have their own physical lanes.

          Do not apply the generic crowding displacement again,
          otherwise the straight centre edge of an odd-number
          parallel group gets pushed much farther away than its
          curved siblings.
        */
        const crowdExtra =
          isParallelGroup
            ? 0
            : crowdLane * 11;
        let relationshipMarginX = 0;
        let relationshipMarginY = -11;
        let qualifierMarginX = 0;
        let qualifierMarginY = 11;
        let adjunctMarginX = 0;
        let adjunctMarginY = hasQualifier ? 24 : 11;

        if (isCurved && isVertical) {
          const length = Math.hypot(deltaX, deltaY) || 1;

          /*
            Physical normal of the edge.

            For a near-vertical edge this points mostly left/right.
          */
          const routeNormalX = -deltaY / length;
          const curveDistance = Number(edge.data("curveDistance") || 0);

          /*
            Determine which physical side of the centre line
            this Bezier actually occupies.

            Using both routeNormalX and curveDistance keeps this
            correct even when source/target direction is reversed.
          */
          let physicalSide = Math.sign(routeNormalX * curveDistance);

          if (physicalSide === 0) {
            physicalSide = 1;
          }

          /*
            Measure the entire annotation bundle.

            We use the widest item so relationship, qualifier and
            adjunct form one neat vertical column rather than each
            having a different horizontal centre.
          */
          const relationshipHalfWidth = measureEdgeLabelHalfWidth(relationship, 12);
          const qualifierHalfWidth = measureEdgeLabelHalfWidth(qualifier, 9);
          const adjunctHalfWidth = measureEdgeLabelHalfWidth(adjunctText, 9);
          const bundleHalfWidth = Math.max(relationshipHalfWidth, qualifierHalfWidth, adjunctHalfWidth, 18);
          const classified = classification === "negative" || classification === "affirmative";

          /*
            Move the whole bundle OUTSIDE its curve.

            This is the important difference from the old code.
            We are no longer shifting it by just a fraction of the
            Bezier distance. We account for the actual text width.
          */
          const outsideGap = classified ? 22 : 18;
          const bundleMarginX = physicalSide * (bundleHalfWidth + outsideGap);
          relationshipMarginX = bundleMarginX;
          qualifierMarginX = bundleMarginX;
          adjunctMarginX = bundleMarginX;

          /*
            Stack the semantic text vertically.

                relationship
                qualifier
                adjunct

            The classification tick/cross remains directly on
            the actual edge because its annotation edge receives
            no text-margin override here.
          */
          if (hasQualifier && hasAdjuncts) {
            relationshipMarginY = -17;
            qualifierMarginY = 0;
            adjunctMarginY = 14;
          } else if (hasQualifier || hasAdjuncts) {
            relationshipMarginY = -11;

            if (hasQualifier) {
              qualifierMarginY = 10;
              adjunctMarginY = 0;
            } else {
              qualifierMarginY = 0;
              adjunctMarginY = 10;
            }
          } else {
            relationshipMarginY = -8;
            qualifierMarginY = 0;
            adjunctMarginY = 0;
          }
        } else if (isCurved) {
          const length = Math.hypot(deltaX, deltaY) || 1;

          /*
            Physical normal of the straight source -> target chord.
          */
          const routeNormalX = -deltaY / length;
          const routeNormalY = deltaX / length;

          /*
            curveDistance already tells us which physical side
            this particular Bezier occupies.

            Multiplying the normal by its sign therefore gives us
            a vector pointing OUTWARD from the centre line toward
            this edge's own curve.

            This works regardless of source -> target direction.
          */
          const curveDistance = Number(edge.data("curveDistance") || 0);
          const curveSide = Math.sign(curveDistance) || 1;
          const outwardX = routeNormalX * curveSide;
          const outwardY = routeNormalY * curveSide;
          const classified = classification === "negative" || classification === "affirmative";

          /*
            Keep the relationship closest to the curve.

            Qualifier and adjunct progressively move farther
            outward so the ✓ / × can remain directly on the edge.
          */
          const relationshipOffset = classified ? 19 : 14;
          const qualifierOffset = relationshipOffset + 13;
          const adjunctOffset = qualifierOffset + (hasQualifier ? 12 : 0);
          relationshipMarginX = outwardX * relationshipOffset;
          relationshipMarginY = outwardY * relationshipOffset;
          qualifierMarginX = outwardX * qualifierOffset;
          qualifierMarginY = outwardY * qualifierOffset;
          adjunctMarginX = outwardX * adjunctOffset;
          adjunctMarginY = outwardY * adjunctOffset;
        } else if (isVertical) {
          /*
            Keep vertical relationships horizontal. Busy neighbouring vertical
            edges progressively move their annotation lanes farther from the
            line rather than painting all text into the same strip.
          */

          relationshipMarginX = -(measureEdgeLabelHalfWidth(relationship, 12) + 14 + crowdExtra);
          const contextHalfWidth = Math.max(
            measureEdgeLabelHalfWidth(qualifier, 9),
            measureEdgeLabelHalfWidth(adjunctText, 9)
          );
          qualifierMarginX = contextHalfWidth + 14 + crowdExtra;
          adjunctMarginX = contextHalfWidth + 14 + crowdExtra;
          relationshipMarginY = 0;
          qualifierMarginY = hasQualifier && hasAdjuncts ? -7 : 0;
          adjunctMarginY = hasQualifier && hasAdjuncts ? 7 : 0;
        } else {
          /*
            Use the edge normal for every diagonal/horizontal label. This keeps
            the three semantic text lanes parallel to the edge and makes the
            crowding offset work regardless of the edge's angle.
          */

          let normalX = -deltaY / edgeLength;
          let normalY = deltaX / edgeLength;

          if (normalY > 0 || (Math.abs(normalY) < 0.001 && normalX > 0)) {
            normalX *= -1;
            normalY *= -1;
          }

          const classified = classification === "negative" || classification === "affirmative";
          const relationshipOffset = (classified ? 19 : 14) + crowdExtra;
          const contextOffset = (classified ? 19 : 14) + crowdExtra;
          const adjunctOffset = contextOffset + (hasQualifier ? 12 : 0);

          relationshipMarginX = normalX * relationshipOffset;
          relationshipMarginY = normalY * relationshipOffset;
          qualifierMarginX = -normalX * contextOffset;
          qualifierMarginY = -normalY * contextOffset;
          adjunctMarginX = -normalX * adjunctOffset;
          adjunctMarginY = -normalY * adjunctOffset;
        }

        /*
          Edge text stays in fixed semantic lanes.  Earlier builds attempted
          to resolve label collisions by repeatedly shifting individual labels
          after layout.  That made large graphs visibly "chase" their labels
          and made node dragging expensive.  Layout now creates the whitespace
          by moving nodes once, so stale presentation shifts are discarded.
        */

        edge.removeData("labelCollisionShiftX");
        edge.removeData("labelCollisionShiftY");

        edge.data({
          labelOrientation: isVertical ? "vertical" : "standard",
          relationshipMarginX,
          relationshipMarginY,
          qualifierMarginX,
          qualifierMarginY,
          adjunctMarginX,
          adjunctMarginY,
        });

        const qualifierAnnotation = cy.getElementById(`__edge-qualifier__${edge.id()}`);
        if (qualifierAnnotation && !qualifierAnnotation.empty()) {
          qualifierAnnotation.data({
            labelOrientation: isVertical ? "vertical" : "standard",
            qualifierMarginX,
            qualifierMarginY,
          });
        }

        const adjunctAnnotation = cy.getElementById(`__edge-adjunct__${edge.id()}`);
        if (adjunctAnnotation && !adjunctAnnotation.empty()) {
          adjunctAnnotation.data({
            labelOrientation: isVertical ? "vertical" : "standard",
            adjunctMarginX,
            adjunctMarginY,
          });
        }
      });
  }

  function isSemanticOwnerGroupNode(node) {
    return (node?.data?.("graphInternal") === "semantic-owner-group");
  }

  function clearSemanticOwnerCompounds(cy = cyRef.current) {
    if (!cy) {
      return;
    }
    const ownerGroups = cy.nodes().filter(node => isSemanticOwnerGroupNode(node));

    /*
      Never remove a compound parent while real semantic nodes are still
      children of it. Cytoscape would remove the descendants as well.
      Move the semantic nodes back to the graph root first, then discard
      only the renderer-only parent.
    */

    ownerGroups.forEach(group => {
      const children = group.children();
      if (!children.empty()) {
        children.move({
          parent: null,
        });
      }
    });
    ownerGroups.remove();
  }

  function getConditionsForOwner(ownerId, cy = cyRef.current) {
    if (!cy || !ownerId) {
      return [];
    }
    return getConditionalNodes(cy)
      .filter(conditionNode => String(conditionNode.data("conditionOwnerId") || "").trim() === String(ownerId))
      .sort((first, second) => first.id().localeCompare(second.id()));
  }

  function getConditionLocalChildNodes(conditionNode) {
    if (!conditionNode || conditionNode.empty()) {
      return [];
    }

    const cy = conditionNode.cy();
    const conditionId = conditionNode.id();
    const localChildren = [];

    /*
      A child can travel with its conditional node only when every semantic
      edge touching that child belongs to the same conditional scope.

      This keeps a private branch such as:

        When heavy rain falls -> Floodwater -> Flood Risk

      together when the condition is moved next to Wetlands, while a shared
      node such as Fish can stay anchored to the wider graph if Pond -> Fish
      also exists outside the drought condition.
    */

    getConditionChildIds(conditionNode).forEach(childId => {
      const childNode = cy.getElementById(childId);
      if (!childNode || childNode.empty()) {
        return;
      }

      if (normaliseNodeType(childNode.data("nodeType"), childNode.data("conditionOwnerId")) === "conditional") {
        return;
      }

      const semanticEdges = childNode
        .connectedEdges()
        .filter(edge => !edge.data("graphInternal"));

      if (semanticEdges.empty()) {
        return;
      }

      const belongsOnlyToCondition = semanticEdges.every(edge => {
        const sourceId = edge.source().id();
        const targetId = edge.target().id();
        const directConditionEdge = sourceId === conditionId || targetId === conditionId;
        const edgeConditionId = String(edge.data("conditionId") || "").trim();
        return directConditionEdge || edgeConditionId === conditionId;
      });

      if (belongsOnlyToCondition) {
        localChildren.push(childNode);
      }
    });

    return localChildren;
  }

  function orientation2d(a, b, c) {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  }

  function segmentsProperlyIntersect(a, b, c, d) {
    const o1 = orientation2d(a, b, c);
    const o2 = orientation2d(a, b, d);
    const o3 = orientation2d(c, d, a);
    const o4 = orientation2d(c, d, b);
    const epsilon = 0.0001;

    /*
      Count genuine X-style crossings only. Shared endpoints and almost-collinear
      overlaps are handled by the label-lane pass instead of being treated as
      topological crossings.
    */

    return (o1 * o2 < -epsilon) && (o3 * o4 < -epsilon);
  }

  function getSemanticEdgeSegments(cy = cyRef.current, excludedEdgeIds = new Set()) {
    if (!cy) {
      return [];
    }

    return cy.edges()
      .filter(edge => edge.visible() && !edge.data("graphInternal") && !excludedEdgeIds.has(edge.id()))
      .toArray()
      .map(edge => ({
        edge,
        sourceId: edge.source().id(),
        targetId: edge.target().id(),
        source: { ...edge.source().position() },
        target: { ...edge.target().position() },
      }));
  }

  function chooseConditionAutoSlot(ownerNode, conditionNode, usedSlotIndexes, fallbackIndex = 0, cy = cyRef.current) {
    if (!ownerNode || ownerNode.empty() || !conditionNode || conditionNode.empty()) {
      return fallbackIndex % CONDITION_AUTO_PLACEMENT_SLOTS.length;
    }

    const ownerPosition = ownerNode.position();
    const conditionPosition = conditionNode.position();
    const dx = conditionPosition.x - ownerPosition.x;
    const dy = conditionPosition.y - ownerPosition.y;
    const distance = Math.hypot(dx, dy);
    const naturalDirection = distance > 1
      ? { x: dx / distance, y: dy / distance }
      : null;

    const ownerWidth = Number(ownerNode.outerWidth()) || 110;
    const ownerHeight = Number(ownerNode.outerHeight()) || 52;
    const conditionWidth = Number(conditionNode.outerWidth()) || 110;
    const conditionHeight = Number(conditionNode.outerHeight()) || 52;
    const horizontalRadius = ownerWidth / 2 + conditionWidth / 2 + 76;
    const verticalRadius = ownerHeight / 2 + conditionHeight / 2 + 68;

    /*
      CoSE gives us a useful first hint, but a condition also needs an empty
      *edge corridor*.  A geometrically empty slot can still be a terrible slot
      when it points directly through one of the owner's normal branches or
      makes a shared child receive two nearly coincident edges.

      Score every unused compass slot using:
        - CoSE's natural direction
        - nearby node clearance
        - owner's existing edge directions
        - projected crossings to shared condition children
        - near-collinearity with owner -> shared-child edges
    */

    const otherNodes = cy
      ? cy.nodes()
          .filter(node => node.visible() && !node.data("graphInternal") &&
            node.id() !== ownerNode.id() && node.id() !== conditionNode.id())
          .toArray()
      : [];

    const conditionEdgeIds = new Set();
    getConditionPropositionEdges(conditionNode).forEach(edge => conditionEdgeIds.add(edge.id()));
    if (cy) {
      cy.edges()
        .filter(edge => !edge.data("graphInternal") &&
          String(edge.data("conditionId") || "").trim() === conditionNode.id())
        .forEach(edge => conditionEdgeIds.add(edge.id()));
    }

    const externalSegments = getSemanticEdgeSegments(cy, conditionEdgeIds);
    const localChildIds = new Set(getConditionLocalChildNodes(conditionNode).map(node => node.id()));
    const sharedChildren = Array.from(getConditionChildIds(conditionNode))
      .filter(childId => !localChildIds.has(childId))
      .map(childId => cy?.getElementById(childId))
      .filter(childNode => childNode && !childNode.empty());

    const ownerIncidentDirections = ownerNode.connectedEdges()
      .filter(edge => edge.visible() && !edge.data("graphInternal") && !conditionEdgeIds.has(edge.id()))
      .toArray()
      .map(edge => {
        const otherNode = edge.source().id() === ownerNode.id() ? edge.target() : edge.source();
        const otherPosition = otherNode.position();
        const edgeDx = otherPosition.x - ownerPosition.x;
        const edgeDy = otherPosition.y - ownerPosition.y;
        const edgeLength = Math.hypot(edgeDx, edgeDy);
        if (edgeLength < 1) {
          return null;
        }
        return {
          x: edgeDx / edgeLength,
          y: edgeDy / edgeLength,
          otherId: otherNode.id(),
        };
      })
      .filter(Boolean);

    let bestIndex = -1;
    let bestScore = -Infinity;

    CONDITION_AUTO_PLACEMENT_SLOTS.forEach((slot, slotIndex) => {
      if (usedSlotIndexes.has(slotIndex)) {
        return;
      }

      const slotLength = Math.hypot(slot.x, slot.y) || 1;
      const slotX = slot.x / slotLength;
      const slotY = slot.y / slotLength;
      const probeX = ownerPosition.x + slot.x * horizontalRadius;
      const probeY = ownerPosition.y + slot.y * verticalRadius;
      const probePosition = { x: probeX, y: probeY };
      let score = 0;

      if (naturalDirection) {
        score += (naturalDirection.x * slotX + naturalDirection.y * slotY) * 0.7;
      }

      let nearestClearance = Infinity;
      let localCrowding = 0;

      otherNodes.forEach(otherNode => {
        const otherPosition = otherNode.position();
        const clearance = Math.hypot(otherPosition.x - probeX, otherPosition.y - probeY);
        nearestClearance = Math.min(nearestClearance, clearance);

        if (clearance < 390) {
          localCrowding += (390 - clearance) / 390;
        }
      });

      if (Number.isFinite(nearestClearance)) {
        score += Math.min(1.8, nearestClearance / 240) * 0.9;
      }
      score -= localCrowding * 0.68;

      /*
        Keep automatic conditions out of the same angular corridor already used
        by ordinary owner edges.  This directly prevents cases such as the
        predator branch being laid on top of Beavers' direct graph links.
      */

      ownerIncidentDirections.forEach(direction => {
        const alignment = direction.x * slotX + direction.y * slotY;
        if (alignment > 0.2) {
          const normalised = (alignment - 0.2) / 0.8;
          score -= normalised * normalised * 4.8;
        }
      });

      sharedChildren.forEach(childNode => {
        const childPosition = childNode.position();

        /*
          If the owner and condition both point to the same shared target, keep
          those two edges visibly separated at the target instead of stacking
          them into one text corridor.
        */

        const ownerChildDx = ownerPosition.x - childPosition.x;
        const ownerChildDy = ownerPosition.y - childPosition.y;
        const conditionChildDx = probeX - childPosition.x;
        const conditionChildDy = probeY - childPosition.y;
        const ownerChildLength = Math.hypot(ownerChildDx, ownerChildDy);
        const conditionChildLength = Math.hypot(conditionChildDx, conditionChildDy);

        if (ownerChildLength > 1 && conditionChildLength > 1) {
          const alignment = (ownerChildDx * conditionChildDx + ownerChildDy * conditionChildDy) /
            (ownerChildLength * conditionChildLength);
          if (alignment > 0.48) {
            const normalised = (alignment - 0.48) / 0.52;
            score -= normalised * normalised * 6.2;
          }
        }

        externalSegments.forEach(segment => {
          if (segment.sourceId === childNode.id() || segment.targetId === childNode.id()) {
            return;
          }
          if (segmentsProperlyIntersect(
            probePosition,
            childPosition,
            segment.source,
            segment.target
          )) {
            score -= 7.2;
          }
        });
      });

      if (score > bestScore) {
        bestScore = score;
        bestIndex = slotIndex;
      }
    });

    if (bestIndex >= 0) {
      return bestIndex;
    }

    for (let offset = 0; offset < CONDITION_AUTO_PLACEMENT_SLOTS.length; offset += 1) {
      const candidate = (fallbackIndex + offset) % CONDITION_AUTO_PLACEMENT_SLOTS.length;
      if (!usedSlotIndexes.has(candidate)) {
        return candidate;
      }
    }

    return fallbackIndex % CONDITION_AUTO_PLACEMENT_SLOTS.length;
  }


  function arrangeConditionLocalBranch(conditionNode, ownerNode, cy = cyRef.current) {
    if (!cy || !conditionNode || conditionNode.empty() || !ownerNode || ownerNode.empty()) {
      return;
    }

    const localChildren = getConditionLocalChildNodes(conditionNode)
      .sort((first, second) => first.id().localeCompare(second.id()));

    if (localChildren.length === 0) {
      return;
    }

    const ownerPosition = ownerNode.position();
    const conditionPosition = conditionNode.position();
    let radialX = conditionPosition.x - ownerPosition.x;
    let radialY = conditionPosition.y - ownerPosition.y;
    let radialLength = Math.hypot(radialX, radialY);

    if (radialLength < 1) {
      radialX = 1;
      radialY = 0;
      radialLength = 1;
    }

    const baseAngle = Math.atan2(radialY / radialLength, radialX / radialLength);

    /*
      Fan condition-private children away from the semantic owner. Translating
      the whole old CoSE branch preserved its shape, but it could preserve a
      bad shape too, including children sitting directly on top of the owner.

      A radial fan gives the condition a small readable local hierarchy:

          owner -> condition -> private child nodes

      Shared children are deliberately excluded by getConditionLocalChildNodes.
    */

    const childCount = localChildren.length;

    /*
      Reserve angular whitespace for edge annotations as well as the nodes.
      Three or four outcomes need a visibly wider fan than two short spokes,
      otherwise the relationship / qualifier / adjunct lanes converge around
      the conditional node even when the child nodes themselves do not overlap.
    */

    const totalSpread = childCount <= 1
      ? 0
      : Math.min(2.15, 0.72 * (childCount - 1));

    localChildren.forEach((childNode, childIndex) => {
      const propositionEdge = findConditionPropositionEdge(conditionNode, childNode.id());
      const edgeDistance = propositionEdge ? getLayoutIdealEdgeLength(propositionEdge) : 240;
      const ring = Math.floor(childIndex / 4);
      const distance = Math.max(255, edgeDistance + 36 + ring * 90);
      const angleOffset = childCount <= 1
        ? 0
        : -totalSpread / 2 + totalSpread * (childIndex / (childCount - 1));
      const angle = baseAngle + angleOffset;

      childNode.position({
        x: conditionPosition.x + Math.cos(angle) * distance,
        y: conditionPosition.y + Math.sin(angle) * distance,
      });
    });
  }

  function positionSemanticOwnerGroup(ownerNode, cy = cyRef.current, {
    arrangeLocalChildren = false,
  } = {}) {
    if (!cy || !ownerNode || ownerNode.empty()) {
      return;
    }

    const conditions = getConditionsForOwner(ownerNode.id(), cy);
    if (conditions.length === 0) {
      return;
    }

    const ownerPosition = ownerNode.position();
    const ownerWidth = Number(ownerNode.outerWidth()) || 110;
    const ownerHeight = Number(ownerNode.outerHeight()) || 52;
    const usedSlotIndexes = new Set();

    conditions.forEach((conditionNode, index) => {
      const previousPosition = {
        ...conditionNode.position(),
      };
      const savedOffsetX = Number(conditionNode.data("conditionOffsetX"));
      const savedOffsetY = Number(conditionNode.data("conditionOffsetY"));
      const placementMode = String(conditionNode.data("conditionPlacement") || "auto").toLowerCase();
      const hasSavedOffset = Number.isFinite(savedOffsetX) && Number.isFinite(savedOffsetY);
      let offsetX;
      let offsetY;

      /*
        A manually dragged conditional keeps its exact relative offset.
      */

      if (placementMode === "manual" && hasSavedOffset) {
        offsetX = savedOffsetX;
        offsetY = savedOffsetY;
      } else {
        const conditionWidth = Number(conditionNode.outerWidth()) || 110;
        const conditionHeight = Number(conditionNode.outerHeight()) || 52;
        const slotIndex = chooseConditionAutoSlot(ownerNode, conditionNode, usedSlotIndexes, index, cy);
        const slot = CONDITION_AUTO_PLACEMENT_SLOTS[slotIndex];
        usedSlotIndexes.add(slotIndex);

        const ring = Math.floor(index / CONDITION_AUTO_PLACEMENT_SLOTS.length);

        /*
          Leave enough breathing room for owner/condition labels, but keep the
          condition close enough that the visual ownership remains obvious.
        */

        const horizontalRadius = ownerWidth / 2 + conditionWidth / 2 + 76 + ring * 145;
        const verticalRadius = ownerHeight / 2 + conditionHeight / 2 + 68 + ring * 110;
        offsetX = slot.x * horizontalRadius;
        offsetY = slot.y * verticalRadius;

        conditionNode.data({
          conditionPlacement: "auto",
          conditionOffsetX: offsetX,
          conditionOffsetY: offsetY,
        });
      }

      const nextPosition = {
        x: ownerPosition.x + offsetX,
        y: ownerPosition.y + offsetY,
      };
      conditionNode.position(nextPosition);

      if (arrangeLocalChildren) {
        arrangeConditionLocalBranch(conditionNode, ownerNode, cy);
      }
    });
  }

  function positionAllSemanticOwnerGroups(cy = cyRef.current, options = {}) {
    if (!cy) {
      return;
    }
    const positionedOwnerIds = new Set();
    getConditionalNodes(cy).forEach(conditionNode => {
      const ownerId = String(conditionNode.data("conditionOwnerId") || "").trim();
      if (!ownerId || positionedOwnerIds.has(ownerId)) {
        return;
      }
      const ownerNode = cy.getElementById(ownerId);
      if (!ownerNode || ownerNode.empty() || ownerNode.id() === conditionNode.id()) {
        return;
      }
      positionedOwnerIds.add(ownerId);
      positionSemanticOwnerGroup(ownerNode, cy, options);
    });
  }


  function getSemanticOwnerClusters(cy = cyRef.current) {
    if (!cy) {
      return [];
    }

    const ownerIds = new Set();
    getConditionalNodes(cy).forEach(conditionNode => {
      const ownerId = String(conditionNode.data("conditionOwnerId") || "").trim();
      if (ownerId) {
        ownerIds.add(ownerId);
      }
    });

    return Array.from(ownerIds)
      .map(ownerId => {
        const ownerNode = cy.getElementById(ownerId);
        if (!ownerNode || ownerNode.empty()) {
          return null;
        }

        const memberMap = new Map([[ownerNode.id(), ownerNode]]);
        getConditionsForOwner(ownerId, cy).forEach(conditionNode => {
          memberMap.set(conditionNode.id(), conditionNode);

          getConditionLocalChildNodes(conditionNode).forEach(childNode => {
            /*
              A semantic node that owns its own conditions is the anchor of
              another cluster. Do not let two cluster translations fight over it.
            */
            if (ownerIds.has(childNode.id()) && childNode.id() !== ownerId) {
              return;
            }
            memberMap.set(childNode.id(), childNode);
          });
        });

        return {
          owner: ownerNode,
          members: Array.from(memberMap.values()),
        };
      })
      .filter(Boolean);
  }

  function getSemanticClusterBounds(cluster, padding = 0) {
    if (!cluster?.members?.length) {
      return null;
    }

    let x1 = Infinity;
    let y1 = Infinity;
    let x2 = -Infinity;
    let y2 = -Infinity;

    cluster.members.forEach(node => {
      if (!node || node.empty() || node.removed()) {
        return;
      }

      const position = node.position();
      const halfWidth = (Number(node.outerWidth()) || 110) / 2;
      const halfHeight = (Number(node.outerHeight()) || 52) / 2;
      x1 = Math.min(x1, position.x - halfWidth);
      y1 = Math.min(y1, position.y - halfHeight);
      x2 = Math.max(x2, position.x + halfWidth);
      y2 = Math.max(y2, position.y + halfHeight);
    });

    if (!Number.isFinite(x1)) {
      return null;
    }

    return {
      x1: x1 - padding,
      y1: y1 - padding,
      x2: x2 + padding,
      y2: y2 + padding,
      width: x2 - x1 + padding * 2,
      height: y2 - y1 + padding * 2,
    };
  }

  function translateSemanticCluster(cluster, deltaX, deltaY) {
    if (!cluster?.members?.length || (!deltaX && !deltaY)) {
      return;
    }

    cluster.members.forEach(node => {
      if (!node || node.empty() || node.removed()) {
        return;
      }
      const position = node.position();
      node.position({
        x: position.x + deltaX,
        y: position.y + deltaY,
      });
    });
  }

  function separateSemanticOwnerClusters(cy = cyRef.current, {
    padding = 105,
    iterations = 18,
  } = {}) {
    if (!cy) {
      return;
    }

    const clusters = getSemanticOwnerClusters(cy);
    if (clusters.length < 2) {
      return;
    }

    /*
      CoSE lays out individual nodes. TreeNotes then deliberately turns each
      condition into a small owner-centred mini graph. The missing piece was a
      second level of layout for those mini graphs themselves.

      Treat each owner + conditions + private condition children as one movable
      island and separate overlapping island envelopes. Internal geometry stays
      intact, so readable condition fans do not get torn apart again.
    */

    for (let pass = 0; pass < iterations; pass += 1) {
      let moved = false;

      for (let firstIndex = 0; firstIndex < clusters.length; firstIndex += 1) {
        for (let secondIndex = firstIndex + 1; secondIndex < clusters.length; secondIndex += 1) {
          const firstCluster = clusters[firstIndex];
          const secondCluster = clusters[secondIndex];
          const firstBounds = getSemanticClusterBounds(firstCluster, padding);
          const secondBounds = getSemanticClusterBounds(secondCluster, padding);

          if (!firstBounds || !secondBounds) {
            continue;
          }

          const overlapX = Math.min(firstBounds.x2, secondBounds.x2) -
            Math.max(firstBounds.x1, secondBounds.x1);
          const overlapY = Math.min(firstBounds.y2, secondBounds.y2) -
            Math.max(firstBounds.y1, secondBounds.y1);

          if (overlapX <= 0 || overlapY <= 0) {
            continue;
          }

          moved = true;
          const firstOwnerPosition = firstCluster.owner.position();
          const secondOwnerPosition = secondCluster.owner.position();

          if (overlapX <= overlapY) {
            let direction = secondOwnerPosition.x >= firstOwnerPosition.x ? 1 : -1;
            if (Math.abs(secondOwnerPosition.x - firstOwnerPosition.x) < 1) {
              direction = secondIndex % 2 === 0 ? 1 : -1;
            }
            const push = overlapX / 2 + 12;
            translateSemanticCluster(firstCluster, -direction * push, 0);
            translateSemanticCluster(secondCluster, direction * push, 0);
          } else {
            let direction = secondOwnerPosition.y >= firstOwnerPosition.y ? 1 : -1;
            if (Math.abs(secondOwnerPosition.y - firstOwnerPosition.y) < 1) {
              direction = secondIndex % 2 === 0 ? 1 : -1;
            }
            const push = overlapY / 2 + 12;
            translateSemanticCluster(firstCluster, 0, -direction * push);
            translateSemanticCluster(secondCluster, 0, direction * push);
          }
        }
      }

      if (!moved) {
        break;
      }
    }
  }


  function getConditionReservationBounds(conditionNode, padding = 58) {
    if (!conditionNode || conditionNode.empty()) {
      return null;
    }

    const members = [conditionNode, ...getConditionLocalChildNodes(conditionNode)];
    let x1 = Infinity;
    let y1 = Infinity;
    let x2 = -Infinity;
    let y2 = -Infinity;

    members.forEach(node => {
      if (!node || node.empty() || node.removed()) {
        return;
      }

      const position = node.position();
      const halfWidth = (Number(node.outerWidth()) || 110) / 2;
      const halfHeight = (Number(node.outerHeight()) || 52) / 2;
      x1 = Math.min(x1, position.x - halfWidth);
      y1 = Math.min(y1, position.y - halfHeight);
      x2 = Math.max(x2, position.x + halfWidth);
      y2 = Math.max(y2, position.y + halfHeight);
    });

    if (!Number.isFinite(x1)) {
      return null;
    }

    return {
      x1: x1 - padding,
      y1: y1 - padding,
      x2: x2 + padding,
      y2: y2 + padding,
    };
  }

  function separateForeignNodesFromConditionReservations(cy = cyRef.current, {
    padding = 64,
    iterations = 7,
  } = {}) {
    if (!cy) {
      return;
    }

    const conditions = getConditionalNodes(cy).toArray();
    if (conditions.length === 0) {
      return;
    }

    /*
      A conditional branch needs whitespace of its own, not merely non-overlap
      between the visible node rectangles.  Direct branches from a neighbouring
      semantic owner used to be allowed to drift through the empty middle of a
      condition + private-child group because that space contained no node for
      the ordinary overlap resolver to collide with.

      Reserve that local branch envelope and gently evict unrelated nodes.  The
      condition owner and every proposition target of the condition are exempt,
      so legitimate shared-target triangles remain possible.
    */

    for (let pass = 0; pass < iterations; pass += 1) {
      let moved = false;

      conditions.forEach(conditionNode => {
        const bounds = getConditionReservationBounds(conditionNode, padding);
        if (!bounds) {
          return;
        }

        const protectedIds = new Set([
          conditionNode.id(),
          String(conditionNode.data("conditionOwnerId") || "").trim(),
          ...Array.from(getConditionChildIds(conditionNode)),
          ...getConditionLocalChildNodes(conditionNode).map(node => node.id()),
        ].filter(Boolean));

        cy.nodes()
          .filter(node => node.visible() && !node.data("graphInternal") && !protectedIds.has(node.id()))
          .forEach(node => {
            if (normaliseNodeType(node.data("nodeType"), node.data("conditionOwnerId")) === "conditional") {
              return;
            }

            const position = node.position();
            const halfWidth = (Number(node.outerWidth()) || 110) / 2;
            const halfHeight = (Number(node.outerHeight()) || 52) / 2;
            const nodeBounds = {
              x1: position.x - halfWidth,
              y1: position.y - halfHeight,
              x2: position.x + halfWidth,
              y2: position.y + halfHeight,
            };

            const overlapX = Math.min(nodeBounds.x2, bounds.x2) - Math.max(nodeBounds.x1, bounds.x1);
            const overlapY = Math.min(nodeBounds.y2, bounds.y2) - Math.max(nodeBounds.y1, bounds.y1);
            if (overlapX <= 0 || overlapY <= 0) {
              return;
            }

            const escapePadding = 16;
            const candidates = [
              { dx: bounds.x1 - nodeBounds.x2 - escapePadding, dy: 0 },
              { dx: bounds.x2 - nodeBounds.x1 + escapePadding, dy: 0 },
              { dx: 0, dy: bounds.y1 - nodeBounds.y2 - escapePadding },
              { dx: 0, dy: bounds.y2 - nodeBounds.y1 + escapePadding },
            ].sort((first, second) =>
              Math.hypot(first.dx, first.dy) - Math.hypot(second.dx, second.dy));

            const escape = candidates[0];
            if (!escape) {
              return;
            }

            node.position({
              x: position.x + escape.dx,
              y: position.y + escape.dy,
            });
            moved = true;
          });
      });

      if (!moved) {
        break;
      }
    }
  }

  function normaliseAngleRadians(angle) {
    let value = angle;
    while (value <= -Math.PI) {
      value += Math.PI * 2;
    }
    while (value > Math.PI) {
      value -= Math.PI * 2;
    }
    return value;
  }

  function angularDistanceRadians(first, second) {
    return Math.abs(normaliseAngleRadians(first - second));
  }

  function getSimpleDirectBranchNodes(ownerNode, rootNode, cy = cyRef.current) {
    if (!cy || !ownerNode || ownerNode.empty() || !rootNode || rootNode.empty()) {
      return [];
    }

    const branch = [];
    const visited = new Set([ownerNode.id()]);
    const queue = [rootNode];

    while (queue.length > 0 && branch.length < 10) {
      const node = queue.shift();
      if (!node || node.empty() || visited.has(node.id())) {
        continue;
      }

      visited.add(node.id());
      branch.push(node);

      node.connectedEdges()
        .filter(edge => edge.visible() && !edge.data("graphInternal"))
        .forEach(edge => {
          const other = edge.source().id() === node.id() ? edge.target() : edge.source();
          if (!other || other.empty() || visited.has(other.id()) || other.id() === ownerNode.id()) {
            return;
          }

          if (normaliseNodeType(other.data("nodeType"), other.data("conditionOwnerId")) === "conditional") {
            return;
          }

          if (getConditionsForOwner(other.id(), cy).length > 0) {
            return;
          }

          /*
            Translate only light chain/leaf continuations with the root.  A
            high-degree hub remains where the wider graph placed it rather than
            having an entire unrelated component dragged around an owner.
          */
          if (getSemanticNodeDegree(other) <= 2 && !other.data("imageSrc")) {
            queue.push(other);
          }
        });
    }

    return branch;
  }

  function translateNodeBranch(nodes, deltaX, deltaY) {
    if (!nodes?.length || (!deltaX && !deltaY)) {
      return;
    }

    nodes.forEach(node => {
      if (!node || node.empty() || node.removed()) {
        return;
      }
      const position = node.position();
      node.position({
        x: position.x + deltaX,
        y: position.y + deltaY,
      });
    });
  }

  function spreadOwnerDirectBranchesAwayFromConditions(cy = cyRef.current) {
    if (!cy) {
      return;
    }

    const allNodes = cy.nodes()
      .filter(node => node.visible() && !node.data("graphInternal"))
      .toArray();
    const allSegments = getSemanticEdgeSegments(cy);

    cy.nodes()
      .filter(ownerNode => ownerNode.visible() && !ownerNode.data("graphInternal") &&
        getConditionsForOwner(ownerNode.id(), cy).length > 0)
      .forEach(ownerNode => {
        const conditions = getConditionsForOwner(ownerNode.id(), cy);
        const ownerPosition = ownerNode.position();
        const blockedAngles = conditions.map(conditionNode => {
          const conditionPosition = conditionNode.position();
          return Math.atan2(
            conditionPosition.y - ownerPosition.y,
            conditionPosition.x - ownerPosition.x
          );
        });

        const directBranches = ownerNode.connectedEdges()
          .filter(edge => {
            if (!edge.visible() || edge.data("graphInternal")) {
              return false;
            }
            if (normaliseEdgeRole(edge.data("edgeRole"), edge.data("isReification") === true ||
              edge.data("reification") === true) === "reification") {
              return false;
            }
            const other = edge.source().id() === ownerNode.id() ? edge.target() : edge.source();
            if (!other || other.empty()) {
              return false;
            }
            return normaliseNodeType(other.data("nodeType"), other.data("conditionOwnerId")) !== "conditional";
          })
          .toArray()
          .map(edge => ({
            edge,
            node: edge.source().id() === ownerNode.id() ? edge.target() : edge.source(),
          }))
          .filter(item => getCorridorNodeMobility(item.node, cy) >= 0.3);

        if (directBranches.length === 0) {
          return;
        }

        const assignedAngles = [];

        directBranches.forEach(({ edge, node }) => {
          const nodePosition = node.position();
          const dx = nodePosition.x - ownerPosition.x;
          const dy = nodePosition.y - ownerPosition.y;
          const currentRadius = Math.max(
            Math.hypot(dx, dy),
            getLayoutIdealEdgeLength(edge) * 0.92,
            185
          );
          const currentAngle = Math.atan2(dy, dx);
          const candidateOffsets = [
            0,
            Math.PI / 12, -Math.PI / 12,
            Math.PI / 6, -Math.PI / 6,
            Math.PI / 4, -Math.PI / 4,
            Math.PI / 3, -Math.PI / 3,
            Math.PI / 2, -Math.PI / 2,
            Math.PI,
          ];

          let best = {
            score: -Infinity,
            angle: currentAngle,
            position: nodePosition,
          };

          candidateOffsets.forEach(offset => {
            const angle = normaliseAngleRadians(currentAngle + offset);
            const candidatePosition = {
              x: ownerPosition.x + Math.cos(angle) * currentRadius,
              y: ownerPosition.y + Math.sin(angle) * currentRadius,
            };
            let score = Math.cos(offset) * 0.7;

            blockedAngles.forEach(blockedAngle => {
              const gap = angularDistanceRadians(angle, blockedAngle);
              if (gap < 0.92) {
                score -= (0.92 - gap) * 7.5;
              } else {
                score += Math.min(1.1, gap - 0.92) * 0.35;
              }
            });

            assignedAngles.forEach(assignedAngle => {
              const gap = angularDistanceRadians(angle, assignedAngle);
              if (gap < 0.48) {
                score -= (0.48 - gap) * 5.2;
              }
            });

            let nearestNodeClearance = Infinity;
            allNodes.forEach(otherNode => {
              if (otherNode.id() === ownerNode.id() || otherNode.id() === node.id()) {
                return;
              }
              const otherPosition = otherNode.position();
              nearestNodeClearance = Math.min(
                nearestNodeClearance,
                Math.hypot(otherPosition.x - candidatePosition.x, otherPosition.y - candidatePosition.y)
              );
            });
            if (Number.isFinite(nearestNodeClearance) && nearestNodeClearance < 170) {
              score -= (170 - nearestNodeClearance) / 34;
            }

            allSegments.forEach(segment => {
              if (segment.edge.id() === edge.id() || segment.sourceId === ownerNode.id() ||
                segment.targetId === ownerNode.id() || segment.sourceId === node.id() ||
                segment.targetId === node.id()) {
                return;
              }
              if (segmentsProperlyIntersect(
                ownerPosition,
                candidatePosition,
                segment.source,
                segment.target
              )) {
                score -= 3.8;
              }
            });

            if (score > best.score) {
              best = {
                score,
                angle,
                position: candidatePosition,
              };
            }
          });

          const deltaX = best.position.x - nodePosition.x;
          const deltaY = best.position.y - nodePosition.y;
          if (Math.hypot(deltaX, deltaY) > 4) {
            translateNodeBranch(
              getSimpleDirectBranchNodes(ownerNode, node, cy),
              deltaX,
              deltaY
            );
          }
          assignedAngles.push(best.angle);
        });
      });
  }

  function getAngleAtVertex(vertex, firstPoint, secondPoint) {
    const firstX = firstPoint.x - vertex.x;
    const firstY = firstPoint.y - vertex.y;
    const secondX = secondPoint.x - vertex.x;
    const secondY = secondPoint.y - vertex.y;
    const firstLength = Math.hypot(firstX, firstY);
    const secondLength = Math.hypot(secondX, secondY);
    if (firstLength < 1 || secondLength < 1) {
      return 0;
    }
    const cosine = Math.max(-1, Math.min(1,
      (firstX * secondX + firstY * secondY) / (firstLength * secondLength)));
    return Math.acos(cosine);
  }

  function resolveSharedConditionTargetCorridors(cy = cyRef.current, {
    minimumAngle = 0.58,
  } = {}) {
    if (!cy) {
      return;
    }

    /*
      A frequent dense case is:

          owner --------> shared target
             \
              condition -> shared target

      Both edges can be long enough yet still carry their labels through almost
      exactly the same corridor. Generic spoke spreading cannot fix this because
      both the semantic owner and the conditional are intentional anchors.

      Rotate the automatic condition around its owner just enough to form a
      readable triangle at the shared target, then rebuild its private fan.
    */

    getConditionalNodes(cy).forEach(conditionNode => {
      if (String(conditionNode.data("conditionPlacement") || "auto").toLowerCase() === "manual") {
        return;
      }

      const ownerId = String(conditionNode.data("conditionOwnerId") || "").trim();
      const ownerNode = ownerId ? cy.getElementById(ownerId) : null;
      if (!ownerNode || ownerNode.empty()) {
        return;
      }

      const localChildIds = new Set(getConditionLocalChildNodes(conditionNode).map(node => node.id()));
      const sharedChildren = Array.from(getConditionChildIds(conditionNode))
        .filter(childId => !localChildIds.has(childId))
        .map(childId => cy.getElementById(childId))
        .filter(childNode => childNode && !childNode.empty())
        .filter(childNode => ownerNode.connectedEdges()
          .filter(edge => edge.visible() && !edge.data("graphInternal"))
          .some(edge => {
            const other = edge.source().id() === ownerNode.id() ? edge.target() : edge.source();
            return other && !other.empty() && other.id() === childNode.id();
          }));

      if (sharedChildren.length === 0) {
        return;
      }

      const ownerPosition = ownerNode.position();
      const conditionPosition = conditionNode.position();
      const radius = Math.max(
        150,
        Math.hypot(conditionPosition.x - ownerPosition.x, conditionPosition.y - ownerPosition.y)
      );
      const baseAngle = Math.atan2(
        conditionPosition.y - ownerPosition.y,
        conditionPosition.x - ownerPosition.x
      );

      const scorePosition = candidatePosition => {
        let score = 0;
        sharedChildren.forEach(childNode => {
          const childPosition = childNode.position();
          const angle = getAngleAtVertex(childPosition, ownerPosition, candidatePosition);
          score += Math.min(1.2, angle / minimumAngle) * 4.6;
          if (angle < minimumAngle) {
            score -= (minimumAngle - angle) * 9;
          }
        });

        cy.nodes()
          .filter(node => node.visible() && !node.data("graphInternal") &&
            node.id() !== ownerNode.id() && node.id() !== conditionNode.id())
          .forEach(node => {
            const position = node.position();
            const clearance = Math.hypot(position.x - candidatePosition.x, position.y - candidatePosition.y);
            if (clearance < 145) {
              score -= (145 - clearance) / 28;
            }
          });

        return score;
      };

      const offsets = [0, 0.22, -0.22, 0.4, -0.4, 0.62, -0.62, 0.82, -0.82];
      let bestPosition = conditionPosition;
      let bestScore = scorePosition(conditionPosition);

      offsets.forEach(offset => {
        const angle = baseAngle + offset;
        const candidatePosition = {
          x: ownerPosition.x + Math.cos(angle) * radius,
          y: ownerPosition.y + Math.sin(angle) * radius,
        };
        const score = scorePosition(candidatePosition) - Math.abs(offset) * 0.45;
        if (score > bestScore + 0.12) {
          bestScore = score;
          bestPosition = candidatePosition;
        }
      });

      if (Math.hypot(
        bestPosition.x - conditionPosition.x,
        bestPosition.y - conditionPosition.y
      ) > 3) {
        conditionNode.position(bestPosition);
        arrangeConditionLocalBranch(conditionNode, ownerNode, cy);
        conditionNode.data({
          conditionOffsetX: bestPosition.x - ownerPosition.x,
          conditionOffsetY: bestPosition.y - ownerPosition.y,
        });
      }
    });
  }

  function syncSemanticOwnerCompounds(cy = cyRef.current) {
    if (!cy) {
      return;
    }

    /*
      The function name is retained so the existing call sites stay small,
      but conditional groups no longer use Cytoscape compound parents.

      COSE treats compound bounds as physical bodies. On larger AI graphs a
      parent containing an owner plus several satellite conditions can become
      enormous, which then pushes unrelated nodes and components far apart.

      conditionOwnerId is already the semantic source of truth, so TreeNotes
      can keep the same visual grouping by positioning conditions around the
      owner without introducing a compound node into the physics simulation.
    */

    clearSemanticOwnerCompounds(cy);

    cy.edges()
      .filter(edge => isInternalConditionOwnerEdge(edge))
      .remove();

    positionAllSemanticOwnerGroups(cy);
    cy.style().update();
  }

  function getConditionPropositionEdges(conditionNode) {
    if (!conditionNode || conditionNode.empty()) {
      return [];
    }
    return conditionNode
      .connectedEdges()
      .filter(edge => !isInternalConditionOwnerEdge(edge) &&
        normaliseEdgeRole(edge.data("edgeRole"), edge.data("isReification") === true ||
          edge.data("reification") === true) !== "reification");
  }

  function getConditionChildIds(conditionNode) {
    const childIds = new Set();
    getConditionPropositionEdges(conditionNode).forEach(edge => {
      const sourceId = edge.source().id();
      const targetId = edge.target().id();
      const otherId = sourceId === conditionNode.id() ? targetId : sourceId;
      if (otherId && otherId !== conditionNode.data("conditionOwnerId")) {
        childIds.add(otherId);
      }
    });
    return childIds;
  }

  function findConditionForReificationEdge(edge, conditionNodes = getConditionalNodes()) {
    if (!edge || edge.empty()) {
      return null;
    }
    const currentRole = normaliseEdgeRole(edge.data("edgeRole"), edge.data("isReification") === true ||
      edge.data("reification") === true);

    /*
      Auto edges must remain genuinely auto-detected.  A conditionId
      cached from a previous pass must not make the result sticky if
      the graph is edited later.
    */

    const explicitConditionId = currentRole === "auto" ? "" : String(edge.data("conditionId") || "").trim();
    if (explicitConditionId) {
      const explicitCondition = edge.cy().getElementById(explicitConditionId);
      if (explicitCondition && !explicitCondition.empty() &&
        normaliseNodeType(explicitCondition.data("nodeType"), explicitCondition.data("conditionOwnerId")) === "conditional") {
        return explicitCondition;
      }
    }
    const sourceId = edge.source().id();
    const targetId = edge.target().id();
    for (let index = 0; index < conditionNodes.length; index += 1) {
      const conditionNode = conditionNodes[index];
      const childIds = getConditionChildIds(conditionNode);
      if (childIds.has(sourceId) && childIds.has(targetId)) {
        return conditionNode;
      }
    }
    return null;
  }

  function findConditionPropositionEdge(conditionNode, childNodeId) {
    if (!conditionNode || conditionNode.empty() || !childNodeId) {
      return null;
    }
    const candidate = getConditionPropositionEdges(conditionNode)
      .filter(edge => {
        const sourceId = edge.source().id();
        const targetId = edge.target().id();
        return ((sourceId === conditionNode.id() && targetId === childNodeId) || (targetId === conditionNode.id() &&
            sourceId === childNodeId));
      });
    return candidate.length > 0 ? candidate[0] : null;
  }

  function getEdgeDisplayLabel(edge) {
    if (!edge || edge.empty()) {
      return "";
    }
    const relationship = String(edge.data("relationship") || "").trim();
    if (!relationship) {
      return "";
    }
    if (edge.data("resolvedEdgeRole") === "reification") {
      return relationship.toUpperCase();
    }
    const sourceNode = edge.source();
    const targetNode = edge.target();
    const sourceIsConditional = normaliseNodeType(sourceNode.data("nodeType"), sourceNode.data("conditionOwnerId")) === "conditional";
    const targetIsConditional = normaliseNodeType(targetNode.data("nodeType"), targetNode.data("conditionOwnerId")) === "conditional";
    const conditionNode = sourceIsConditional ? sourceNode : targetIsConditional ? targetNode : null;
    if (!conditionNode) {
      return relationship;
    }
    const ownerId = String(conditionNode.data("conditionOwnerId") || "").trim();
    const ownerNode = ownerId ? edge.cy().getElementById(ownerId) : null;
    if (!ownerNode || ownerNode.empty()) {
      return relationship;
    }
    const ownerLabel = String(ownerNode.data("label") || ownerNode.id()).trim();
    if (!ownerLabel) {
      return relationship;
    }
    if (relationship
      .toLowerCase()
      .startsWith(ownerLabel.toLowerCase())) {
      return relationship;
    }
    return `${ownerLabel} ${relationship}`;
  }

  function isEdgeAnnotationElement(element) {
    const internalType = String(element?.data?.("graphInternal") || "");
    return (internalType === "edge-qualifier-label" || internalType === "edge-adjunct-label" ||
      internalType === "edge-negative-mark" || internalType === "edge-affirmative-mark"
    );
  }

  function clearEdgeAnnotationPresentation(cy = cyRef.current) {
    if (!cy) {
      return;
    }
    cy.edges()
      .filter(edge => isEdgeAnnotationElement(edge))
      .remove();
  }

  function syncEdgeAnnotationPresentation(cy = cyRef.current) {
    if (!cy) {
      return;
    }
    clearEdgeAnnotationPresentation(cy);
    const annotationEdges = [];
    cy.edges()
      .filter(edge => !edge.data("graphInternal"))
      .forEach(edge => {
        const qualifier = String(edge.data("qualifier") || "").trim();
        const adjuncts = normaliseEdgeAdjuncts(edge.data("adjuncts"));
        const classification = normaliseEdgeClassification(edge.data("classification"));
        if (qualifier) {
          annotationEdges.push({
            group: "edges",
            data: {
              id: `__edge-qualifier__${edge.id()}`,
              source: edge.source().id(),
              target: edge.target().id(),
              displayLabel: qualifier,
              graphInternal: "edge-qualifier-label",
              semanticEdgeId: edge.id(),
            },
            selectable: false,
          });
        }
        if (adjuncts.length > 0) {
          annotationEdges.push({
            group: "edges",
            data: {
              id: `__edge-adjunct__${edge.id()}`,
              source: edge.source().id(),
              target: edge.target().id(),
              displayLabel: adjuncts.join(" · "),
              graphInternal: "edge-adjunct-label",
              semanticEdgeId: edge.id(),
            },
            selectable: false,
          });
        }
        if (classification === "affirmative") {
          annotationEdges.push({
            group: "edges",
            data: {
              id: `__edge-affirmative__${edge.id()}`,
              source: edge.source().id(),
              target: edge.target().id(),
              displayLabel: "✓",
              graphInternal: "edge-affirmative-mark",
              semanticEdgeId: edge.id(),
            },
            selectable: false,
          });
        }
        if (classification === "negative") {
          annotationEdges.push({
            group: "edges",
            data: {
              id: `__edge-negative__${edge.id()}`,
              source: edge.source().id(),
              target: edge.target().id(),
              displayLabel: "×",
              graphInternal: "edge-negative-mark",
              semanticEdgeId: edge.id(),
            },
            selectable: false,
          });
        }
      });
    if (annotationEdges.length > 0) {
      cy.add(annotationEdges);
    }
    syncEdgeLabelGeometry(cy);
  }

  function getVisibleGraphElements(cy = cyRef.current) {
    if (!cy) {
      return null;
    }

    /*
      Fit only the semantic graph. Renderer-only annotation edges and legacy
      compound helpers can otherwise enlarge the calculated bounding box even
      though the user cannot see them as graph content.
    */

    return cy.elements().filter(element => element.visible() && !element.data("graphInternal"));
  }

  function fitVisibleGraph(cy = cyRef.current, padding = 50) {
    if (!cy) {
      return;
    }
    const elements = getVisibleGraphElements(cy);
    if (!elements || elements.empty()) {
      return;
    }
    cy.fit(elements, padding);
    if (cy.zoom() > 1.35) {
      cy.zoom(1.35);
      cy.center(elements);
    }
  }

  function measureLayoutLabelWidth(text, fontSize = 12, fontWeight = 500) {
    const cleanText = String(text || "").trim();
    if (!cleanText) {
      return 0;
    }

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) {
      return cleanText.length * fontSize * 0.56;
    }

    context.font = `${fontWeight} ${fontSize}px Inter, system-ui, sans-serif`;
    return context.measureText(cleanText).width;
  }

  function getLayoutNodeRadius(node) {
    if (!node || node.empty()) {
      return 58;
    }

    const width = Number(node.outerWidth()) || 110;
    const height = Number(node.outerHeight()) || 52;

    /*
      CoSE works with node centre points. Give every endpoint enough radial
      clearance for its real rendered body before we reserve any room for
      relationship / qualifier / adjunct text.
    */

    return Math.max(38, Math.max(width, height) * 0.56);
  }

  function getLayoutIdealEdgeLength(edge) {
    if (!edge || edge.empty()) {
      return 220;
    }

    const relationship = String(
      edge.data("displayLabel") ||
      getEdgeDisplayLabel(edge) ||
      edge.data("relationship") ||
      ""
    ).trim();
    const qualifier = String(edge.data("qualifier") || "").trim();
    const adjunctText = normaliseEdgeAdjuncts(edge.data("adjuncts")).join(" · ");
    const resolvedRole = edge.data("resolvedEdgeRole") || normaliseEdgeRole(edge.data("edgeRole"));
    const sourceNode = edge.source();
    const targetNode = edge.target();
    const touchesCondition =
      normaliseNodeType(sourceNode.data("nodeType"), sourceNode.data("conditionOwnerId")) === "conditional" ||
      normaliseNodeType(targetNode.data("nodeType"), targetNode.data("conditionOwnerId")) === "conditional";

    /*
      Reserve actual pixel room for the visible annotation lanes.

      The previous implementation capped every edge at about 205 graph units.
      That is shorter than the combined radii of a medium image node and a
      normal node, before a single character of edge text is considered.
    */

    const relationshipWidth = measureLayoutLabelWidth(relationship, 12, resolvedRole === "reification" ? 700 : 500);
    const qualifierWidth = measureLayoutLabelWidth(qualifier, 9, 400);
    const adjunctWidth = measureLayoutLabelWidth(adjunctText, 9, 500);
    const annotationWidth = Math.max(relationshipWidth, qualifierWidth, adjunctWidth);

    const endpointClearance =
      getLayoutNodeRadius(sourceNode) +
      getLayoutNodeRadius(targetNode);

    const textCorridor = Math.max(70, Math.min(240, annotationWidth + 34));
    let idealLength = endpointClearance + textCorridor;

    if (touchesCondition) {
      idealLength += 24;
    }
    if (resolvedRole === "reification") {
      idealLength += 30;
    }

    return Math.max(210, Math.min(520, idealLength));
  }

  function getLayoutNodeRepulsion(node) {
    if (!node || node.empty()) {
      return 14000;
    }

    const width = Number(node.outerWidth()) || 110;
    const height = Number(node.outerHeight()) || 52;
    const area = width * height;
    const sizeAllowance = Math.min(14000, area * 0.18);

    /*
      Keep normal nodes separated while giving picture nodes extra room.
      fitVisibleGraph() handles the final viewport scale, so readability wins
      over forcing every centre point unnaturally close together.
    */

    return 12500 + sizeAllowance;
  }

  function getEdgeAnnotationCorridorWidth(edge) {
    if (!edge || edge.empty()) {
      return 70;
    }

    const relationship = String(
      edge.data("displayLabel") ||
      getEdgeDisplayLabel(edge) ||
      edge.data("relationship") ||
      ""
    ).trim();
    const qualifier = String(edge.data("qualifier") || "").trim();
    const adjunctText = normaliseEdgeAdjuncts(edge.data("adjuncts")).join(" · ");
    const resolvedRole = edge.data("resolvedEdgeRole") || normaliseEdgeRole(edge.data("edgeRole"));

    return Math.max(
      70,
      measureLayoutLabelWidth(relationship, 12, resolvedRole === "reification" ? 700 : 500),
      measureLayoutLabelWidth(qualifier, 9, 400),
      measureLayoutLabelWidth(adjunctText, 9, 500)
    );
  }

  function getSemanticNodeDegree(node) {
    if (!node || node.empty()) {
      return 0;
    }

    return node.connectedEdges()
      .filter(edge => edge.visible() && !edge.data("graphInternal"))
      .length;
  }

  function getCorridorNodeMobility(node, cy = cyRef.current) {
    if (!node || node.empty() || node.data("graphInternal")) {
      return 0;
    }

    const nodeType = normaliseNodeType(node.data("nodeType"), node.data("conditionOwnerId"));
    if (nodeType === "conditional") {
      return 0;
    }

    /*
      Owners are anchors for their condition satellites.  Moving an owner as a
      single endpoint would tear its semantic mini-graph apart, so owner-group
      spacing is handled by separateSemanticOwnerClusters() instead.
    */

    if (getConditionsForOwner(node.id(), cy).length > 0) {
      return 0;
    }

    const degree = getSemanticNodeDegree(node);
    let mobility = degree <= 1 ? 1 : degree === 2 ? 0.72 : degree === 3 ? 0.36 : 0.12;

    if (node.data("imageSrc")) {
      mobility *= 0.28;
    }

    return mobility;
  }

  function spreadSemanticEdgeCorridors(cy = cyRef.current, {
    iterations = 4,
    minimumAngle = 0.34,
    maximumAngle = 0.9,
  } = {}) {
    if (!cy) {
      return;
    }

    /*
      Label readability is primarily a NODE placement problem.  Two incident
      edges can have perfectly adequate length yet still paint their text over
      one another when they leave a hub at nearly the same angle.

      This pass runs only after the force layout has finished.  It opens those
      crowded spokes by rotating movable low-degree endpoints around the hub,
      preserving their distance from the hub.  No label is independently moved,
      and this routine is never run during a drag gesture.
    */

    const hubs = cy.nodes()
      .filter(node => node.visible() && !node.data("graphInternal"))
      .toArray();

    for (let pass = 0; pass < iterations; pass += 1) {
      let changed = false;

      hubs.forEach(hub => {
        if (hub.removed()) {
          return;
        }

        const hubPosition = hub.position();
        const incident = hub.connectedEdges()
          .filter(edge => edge.visible() && !edge.data("graphInternal"))
          .toArray()
          .map(edge => {
            const other = edge.source().id() === hub.id() ? edge.target() : edge.source();
            const otherPosition = other.position();
            const dx = otherPosition.x - hubPosition.x;
            const dy = otherPosition.y - hubPosition.y;
            return {
              edge,
              other,
              radius: Math.max(1, Math.hypot(dx, dy)),
              angle: Math.atan2(dy, dx),
              corridor: getEdgeAnnotationCorridorWidth(edge),
            };
          })
          .sort((first, second) => first.angle - second.angle);

        if (incident.length < 2) {
          return;
        }

        for (let index = 0; index < incident.length; index += 1) {
          const first = incident[index];
          const second = incident[(index + 1) % incident.length];
          let secondAngle = second.angle;
          if (index === incident.length - 1) {
            secondAngle += Math.PI * 2;
          }

          const currentGap = secondAngle - first.angle;
          const midpointRadius = Math.max(70, Math.min(first.radius, second.radius) * 0.5);
          const textDemand = (first.corridor + second.corridor) * 0.28 + 24;
          const geometryAngle = Math.min(
            maximumAngle,
            Math.max(minimumAngle, textDemand / midpointRadius)
          );

          if (currentGap >= geometryAngle) {
            continue;
          }

          const firstMobility = getCorridorNodeMobility(first.other, cy);
          const secondMobility = getCorridorNodeMobility(second.other, cy);
          const mobilityTotal = firstMobility + secondMobility;
          if (mobilityTotal <= 0.001) {
            continue;
          }

          const deficit = Math.min(0.42, geometryAngle - currentGap);
          const firstShare = firstMobility / mobilityTotal;
          const secondShare = secondMobility / mobilityTotal;
          const nextFirstAngle = first.angle - deficit * firstShare;
          const nextSecondAngle = secondAngle + deficit * secondShare;

          if (firstMobility > 0) {
            first.other.position({
              x: hubPosition.x + Math.cos(nextFirstAngle) * first.radius,
              y: hubPosition.y + Math.sin(nextFirstAngle) * first.radius,
            });
            first.angle = nextFirstAngle;
          }

          if (secondMobility > 0) {
            const normalisedAngle = nextSecondAngle > Math.PI
              ? nextSecondAngle - Math.PI * 2
              : nextSecondAngle;
            second.other.position({
              x: hubPosition.x + Math.cos(normalisedAngle) * second.radius,
              y: hubPosition.y + Math.sin(normalisedAngle) * second.radius,
            });
            second.angle = normalisedAngle;
          }

          changed = true;
        }
      });

      if (!changed) {
        break;
      }
    }
  }

  function countSemanticEdgeCrossings(cy = cyRef.current, onlyEdgeIds = null) {
    if (!cy) {
      return 0;
    }

    const allEdges = cy.edges()
      .filter(edge => edge.visible() && !edge.data("graphInternal"))
      .toArray();
    const primaryEdges = onlyEdgeIds
      ? allEdges.filter(edge => onlyEdgeIds.has(edge.id()))
      : allEdges;
    const seenPairs = new Set();
    let crossings = 0;

    primaryEdges.forEach(edge => {
      const sourceId = edge.source().id();
      const targetId = edge.target().id();
      const sourcePosition = edge.source().position();
      const targetPosition = edge.target().position();

      allEdges.forEach(other => {
        if (edge.id() === other.id()) {
          return;
        }

        const pairKey = [edge.id(), other.id()].sort().join("::");
        if (seenPairs.has(pairKey)) {
          return;
        }
        seenPairs.add(pairKey);

        if (sourceId === other.source().id() || sourceId === other.target().id() ||
          targetId === other.source().id() || targetId === other.target().id()) {
          return;
        }

        if (segmentsProperlyIntersect(
          sourcePosition,
          targetPosition,
          other.source().position(),
          other.target().position()
        )) {
          crossings += 1;
        }
      });
    });

    return crossings;
  }

  function reduceSemanticEdgeCrossings(cy = cyRef.current, {
    iterations = 2,
    angleStep = 0.22,
  } = {}) {
    if (!cy) {
      return;
    }

    /*
      CoSE minimises energy, not crossings.  Make a small, deterministic final
      pass over low-degree nodes only.  For a node involved in a crossing, try
      a few rotations around one of its neighbours and keep the candidate only
      when it reduces the number of genuine semantic edge intersections.

      The pass is intentionally bounded and runs only once at layout completion,
      so it improves topology without bringing back the v4 performance problem.
    */

    for (let pass = 0; pass < iterations; pass += 1) {
      let improved = false;
      const edges = cy.edges()
        .filter(edge => edge.visible() && !edge.data("graphInternal"))
        .toArray();

      for (let firstIndex = 0; firstIndex < edges.length; firstIndex += 1) {
        const first = edges[firstIndex];
        for (let secondIndex = firstIndex + 1; secondIndex < edges.length; secondIndex += 1) {
          const second = edges[secondIndex];
          const ids = new Set([
            first.source().id(),
            first.target().id(),
            second.source().id(),
            second.target().id(),
          ]);
          if (ids.size < 4) {
            continue;
          }

          if (!segmentsProperlyIntersect(
            first.source().position(),
            first.target().position(),
            second.source().position(),
            second.target().position()
          )) {
            continue;
          }

          const candidates = [
            { node: first.source(), anchor: first.target() },
            { node: first.target(), anchor: first.source() },
            { node: second.source(), anchor: second.target() },
            { node: second.target(), anchor: second.source() },
          ]
            .map(candidate => ({
              ...candidate,
              mobility: getCorridorNodeMobility(candidate.node, cy),
            }))
            .filter(candidate => candidate.mobility >= 0.35)
            .sort((a, b) => b.mobility - a.mobility);

          if (candidates.length === 0) {
            continue;
          }

          const candidate = candidates[0];
          const node = candidate.node;
          const anchor = candidate.anchor;
          const original = { ...node.position() };
          const anchorPosition = anchor.position();
          const dx = original.x - anchorPosition.x;
          const dy = original.y - anchorPosition.y;
          const radius = Math.max(80, Math.hypot(dx, dy));
          const baseAngle = Math.atan2(dy, dx);
          const incidentIds = new Set(
            node.connectedEdges()
              .filter(edge => edge.visible() && !edge.data("graphInternal"))
              .map(edge => edge.id())
          );
          const originalCrossings = countSemanticEdgeCrossings(cy, incidentIds);
          let bestCrossings = originalCrossings;
          let bestPosition = original;

          [-2, -1, 1, 2].forEach(multiplier => {
            const angle = baseAngle + angleStep * multiplier;
            node.position({
              x: anchorPosition.x + Math.cos(angle) * radius,
              y: anchorPosition.y + Math.sin(angle) * radius,
            });
            const crossings = countSemanticEdgeCrossings(cy, incidentIds);
            if (crossings < bestCrossings) {
              bestCrossings = crossings;
              bestPosition = { ...node.position() };
            }
          });

          node.position(bestPosition);
          if (bestCrossings < originalCrossings) {
            improved = true;
          } else {
            node.position(original);
          }
        }
      }

      if (!improved) {
        break;
      }
    }
  }

  function placeConditionsFromSavedOffsets(ownerNode, cy = cyRef.current) {
    if (!cy || !ownerNode || ownerNode.empty()) {
      return;
    }

    const ownerPosition = ownerNode.position();
    getConditionsForOwner(ownerNode.id(), cy).forEach(conditionNode => {
      const offsetX = Number(conditionNode.data("conditionOffsetX"));
      const offsetY = Number(conditionNode.data("conditionOffsetY"));
      if (!Number.isFinite(offsetX) || !Number.isFinite(offsetY)) {
        return;
      }
      conditionNode.position({
        x: ownerPosition.x + offsetX,
        y: ownerPosition.y + offsetY,
      });
    });
  }

  function enforceSemanticEdgeClearance(cy = cyRef.current, {
    iterations = 4,
    minimumRatio = 0.9,
  } = {}) {
    if (!cy) {
      return;
    }

    const edges = cy.edges()
      .filter(edge => edge.visible() && !edge.data("graphInternal"))
      .toArray();

    for (let pass = 0; pass < iterations; pass += 1) {
      let moved = false;

      edges.forEach((edge, edgeIndex) => {
        if (edge.removed()) {
          return;
        }

        const source = edge.source();
        const target = edge.target();
        const sourcePosition = source.position();
        const targetPosition = target.position();
        let dx = targetPosition.x - sourcePosition.x;
        let dy = targetPosition.y - sourcePosition.y;
        let distance = Math.hypot(dx, dy);

        if (distance < 0.001) {
          const angle = (edgeIndex + 1) * 2.399963229728653;
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          distance = 1;
        }

        const minimumDistance = getLayoutIdealEdgeLength(edge) * minimumRatio;
        if (distance >= minimumDistance) {
          return;
        }

        moved = true;
        const unitX = dx / distance;
        const unitY = dy / distance;
        const deficit = minimumDistance - distance;

        const sourceArea = Math.max(1, source.outerWidth() * source.outerHeight());
        const targetArea = Math.max(1, target.outerWidth() * target.outerHeight());
        let sourceMobility = 1 / Math.sqrt(sourceArea);
        let targetMobility = 1 / Math.sqrt(targetArea);

        const sourceIsCondition = normaliseNodeType(
          source.data("nodeType"),
          source.data("conditionOwnerId")
        ) === "conditional";
        const targetIsCondition = normaliseNodeType(
          target.data("nodeType"),
          target.data("conditionOwnerId")
        ) === "conditional";

        /*
          Keep condition satellites close to their semantic owner. When a
          condition edge is too short, push the proposition node outward much
          more than the conditional node itself.
        */

        if (sourceIsCondition && !targetIsCondition) {
          sourceMobility *= 0.18;
        } else if (targetIsCondition && !sourceIsCondition) {
          targetMobility *= 0.18;
        }

        const mobilityTotal = sourceMobility + targetMobility || 1;
        const sourceShare = sourceMobility / mobilityTotal;
        const targetShare = targetMobility / mobilityTotal;

        source.position({
          x: sourcePosition.x - unitX * deficit * sourceShare,
          y: sourcePosition.y - unitY * deficit * sourceShare,
        });
        target.position({
          x: targetPosition.x + unitX * deficit * targetShare,
          y: targetPosition.y + unitY * deficit * targetShare,
        });
      });

      if (!moved) {
        break;
      }
    }
  }

  function resolveSemanticNodeOverlaps(cy = cyRef.current, {
    padding = 30,
    iterations = 18,
  } = {}) {
    if (!cy) {
      return;
    }

    const nodes = cy.nodes()
      .filter(node => node.visible() && !node.data("graphInternal"))
      .toArray();

    if (nodes.length < 2) {
      return;
    }

    /*
      TreeNotes performs semantic positioning after CoSE. That post-layout pass
      can create fresh collisions, especially beside large image nodes. Resolve
      only those final bounding-box overlaps here.
    */

    for (let pass = 0; pass < iterations; pass += 1) {
      let moved = false;

      for (let firstIndex = 0; firstIndex < nodes.length; firstIndex += 1) {
        const first = nodes[firstIndex];
        if (first.removed()) {
          continue;
        }

        for (let secondIndex = firstIndex + 1; secondIndex < nodes.length; secondIndex += 1) {
          const second = nodes[secondIndex];
          if (second.removed()) {
            continue;
          }

          const firstPosition = first.position();
          const secondPosition = second.position();
          let dx = secondPosition.x - firstPosition.x;
          let dy = secondPosition.y - firstPosition.y;

          if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
            const angle = ((firstIndex + 1) * 1.618 + (secondIndex + 1) * 0.73) * Math.PI;
            dx = Math.cos(angle);
            dy = Math.sin(angle);
          }

          const firstHalfWidth = (Number(first.outerWidth()) || 110) / 2;
          const firstHalfHeight = (Number(first.outerHeight()) || 52) / 2;
          const secondHalfWidth = (Number(second.outerWidth()) || 110) / 2;
          const secondHalfHeight = (Number(second.outerHeight()) || 52) / 2;

          const overlapX = firstHalfWidth + secondHalfWidth + padding - Math.abs(dx);
          const overlapY = firstHalfHeight + secondHalfHeight + padding - Math.abs(dy);

          if (overlapX <= 0 || overlapY <= 0) {
            continue;
          }

          moved = true;

          const firstArea = Math.max(1, first.outerWidth() * first.outerHeight());
          const secondArea = Math.max(1, second.outerWidth() * second.outerHeight());
          const firstMobility = 1 / Math.sqrt(firstArea);
          const secondMobility = 1 / Math.sqrt(secondArea);
          const mobilityTotal = firstMobility + secondMobility;
          const firstShare = firstMobility / mobilityTotal;
          const secondShare = secondMobility / mobilityTotal;

          if (overlapX < overlapY) {
            const direction = dx >= 0 ? 1 : -1;
            const push = overlapX + 3;
            first.position("x", firstPosition.x - direction * push * firstShare);
            second.position("x", secondPosition.x + direction * push * secondShare);
          } else {
            const direction = dy >= 0 ? 1 : -1;
            const push = overlapY + 3;
            first.position("y", firstPosition.y - direction * push * firstShare);
            second.position("y", secondPosition.y + direction * push * secondShare);
          }
        }
      }

      if (!moved) {
        break;
      }
    }

    getConditionalNodes(cy).forEach(conditionNode => {
      if (String(conditionNode.data("conditionPlacement") || "auto").toLowerCase() === "manual") {
        return;
      }

      const ownerId = String(conditionNode.data("conditionOwnerId") || "").trim();
      const ownerNode = ownerId ? cy.getElementById(ownerId) : null;
      if (!ownerNode || ownerNode.empty()) {
        return;
      }

      const conditionPosition = conditionNode.position();
      const ownerPosition = ownerNode.position();
      conditionNode.data({
        conditionOffsetX: conditionPosition.x - ownerPosition.x,
        conditionOffsetY: conditionPosition.y - ownerPosition.y,
      });
    });
  }

  function runCompactGraphLayout(cy = cyRef.current, {
    animate = true,
    padding = 50,
    randomize = true,
  } = {}) {
    if (!cy) {
      return null;
    }

    /*
      Layout only real semantic elements. Qualifier/adjunct/classification
      annotations are duplicate renderer edges and should never contribute
      extra forces to COSE.
    */

    const semanticElements = getVisibleGraphElements(cy);
    if (!semanticElements || semanticElements.empty()) {
      return null;
    }

    const layout = semanticElements.layout({
      name: "cose",
      animate: animate ? "end" : false,
      animationDuration: animate ? 420 : 0,
      fit: false,
      padding,
      randomize,

      /*
        Edge springs are sized from rendered node bodies and annotation text.
        Moderate repulsion keeps separate concepts readable, while the final
        viewport fit prevents the graph from escaping the visible canvas.
      */

      idealEdgeLength: getLayoutIdealEdgeLength,
      nodeRepulsion: getLayoutNodeRepulsion,
      edgeElasticity: () => 95,
      nodeOverlap: 42,
      componentSpacing: 68,
      gravity: 1.15,
      numIter: 1800,
      nodeDimensionsIncludeLabels: true,
    });

    layout.one("layoutstop", () => {
      cy.resize();

      /*
        All expensive geometry is now a ONE-TIME post-layout operation.  Batch
        it so Cytoscape does not repaint after every small correction.  This is
        the opposite of the retired label-collision system, which repeatedly
        moved text while the graph was settling and during node dragging.
      */

      cy.batch(() => {
        positionAllSemanticOwnerGroups(cy, {
          arrangeLocalChildren: true,
        });

        separateSemanticOwnerClusters(cy, {
          padding: 112,
          iterations: 16,
        });

        /*
          Re-score condition directions once cluster neighbourhoods are known,
          then reserve angular corridors around busy hubs for edge annotation
          text.  Nodes move; labels remain in their normal semantic lanes.
        */

        positionAllSemanticOwnerGroups(cy, {
          arrangeLocalChildren: true,
        });

        /*
          Give each semantic owner two kinds of territory:
            1. its conditional branch sectors, and
            2. separate sectors for ordinary direct graph links.

          This keeps a Wetlands -> Pollution style branch from wandering through
          the Beavers predator-condition group when there is open space elsewhere.
        */

        spreadOwnerDirectBranchesAwayFromConditions(cy);
        resolveSharedConditionTargetCorridors(cy, {
          minimumAngle: 0.6,
        });
        separateForeignNodesFromConditionReservations(cy, {
          padding: 70,
          iterations: 7,
        });

        spreadSemanticEdgeCorridors(cy, {
          iterations: 4,
          minimumAngle: 0.42,
          maximumAngle: 0.94,
        });

        reduceSemanticEdgeCrossings(cy, {
          iterations: 2,
          angleStep: 0.24,
        });

        enforceSemanticEdgeClearance(cy, {
          iterations: 4,
          minimumRatio: 1.0,
        });

        resolveSemanticNodeOverlaps(cy, {
          padding: 48,
          iterations: 16,
        });

        separateSemanticOwnerClusters(cy, {
          padding: 96,
          iterations: 8,
        });

        /*
          Re-assert the reserved conditional branch envelopes after the generic
          cleanup passes.  Unlike moving edge labels, this is a small one-time
          node correction and therefore does not create drag-time lag.
        */

        separateForeignNodesFromConditionReservations(cy, {
          padding: 62,
          iterations: 4,
        });
        resolveSharedConditionTargetCorridors(cy, {
          minimumAngle: 0.56,
        });

        spreadSemanticEdgeCorridors(cy, {
          iterations: 2,
          minimumAngle: 0.4,
          maximumAngle: 0.84,
        });
      });

      syncEdgeLabelGeometry(cy);
      cy.style().update();
      fitVisibleGraph(cy, padding);
    });

    layout.run();
    return layout;
  }

  function syncConditionalGraphSemantics(cy = cyRef.current) {
    if (!cy) {
      return;
    }

    /*
      Rebuild renderer-only semantic helpers from the real saved graph.
      Conditions are positioned relative to their semantic owner without
      becoming Cytoscape compound children; annotation edges remain
      presentation-only.
    */

    clearEdgeAnnotationPresentation(cy);
    syncSemanticOwnerCompounds(cy);
    const conditionalNodes = getConditionalNodes(cy);
    conditionalNodes.forEach((conditionNode, conditionIndex) => {
      const existingConditionColour = conditionNode.data("conditionColor");
      const existingNodeColour = conditionNode.data("color");
      const hadConditionColour = Boolean(existingConditionColour || existingNodeColour);
      const conditionColour = hadConditionColour ? (existingConditionColour || existingNodeColour)
        : CONDITIONAL_NODE_MUTED_PALETTE[conditionIndex %
        CONDITIONAL_NODE_MUTED_PALETTE.length];
      const existingBorder = conditionNode.data("borderColor");
      const borderAutoSetting = conditionNode.data("conditionBorderAuto");

      /*
        Older GraphPanel builds defaulted the border to the same colour
        as the conditional fill. Treat that combination as the legacy
        automatic border unless the user has explicitly customised it.
      */

      const looksLikeLegacyAutoBorder = borderAutoSetting == null && (!existingBorder || existingBorder ===
          existingConditionColour || existingBorder === conditionColour);
      const useAutomaticBorder = borderAutoSetting === true || looksLikeLegacyAutoBorder;
      conditionNode.data({
        nodeType: "conditional",
        conditionColor: conditionColour,
        color: conditionColour,
        conditionColorAuto: hadConditionColour ? Boolean(conditionNode.data("conditionColorAuto")) : true,
        textColor: conditionNode.data("textColor") || CONDITIONAL_NODE_DEFAULT_TEXT_COLOR,
        borderColor: useAutomaticBorder ? getConditionalDefaultBorderColour() : existingBorder,
        conditionBorderAuto: useAutomaticBorder,
      });
    });
    cy.edges().forEach(edge => {
      if (edge.data("graphInternal")) {
        return;
      }
      const requestedRole = normaliseEdgeRole(edge.data("edgeRole"), edge.data("isReification") === true ||
        edge.data("reification") === true);
      edge.data("edgeRole", requestedRole);
      const inferredCondition = findConditionForReificationEdge(edge, conditionalNodes);
      const resolvedRole = requestedRole === "reification" ? "reification" : requestedRole === "standard" ? "standard"
          : inferredCondition ? "reification" : "standard";
      edge.data("resolvedEdgeRole", resolvedRole);
      const resolvedClassification = normaliseEdgeClassification(edge.data("classification"));
      edge.data("resolvedClassification", resolvedClassification);

      const sourceNode = edge.source();
      const targetNode = edge.target();
      const sourceIsConditional = normaliseNodeType(sourceNode.data("nodeType"), sourceNode.data("conditionOwnerId")) === "conditional";
      const targetIsConditional = normaliseNodeType(targetNode.data("nodeType"), targetNode.data("conditionOwnerId")) === "conditional";
      const directConditionNode = sourceIsConditional ? sourceNode : targetIsConditional ? targetNode : null;
      if (directConditionNode) {
        edge.data("conditionEdge", true);
        if (!edge.data("conditionId")) {
          edge.data("conditionId", directConditionNode.id());
        }
      } else {
        edge.removeData("conditionEdge");
        if (requestedRole === "auto" && !inferredCondition) {
          edge.removeData("conditionId");
        }
      }
      if (resolvedRole === "reification") {

        /*
          Preserve explicit proposition-edge IDs supplied by the AI.
          This matters when streamed edges arrive out of order or when a
          condition contains multiple proposition edges involving the same
          visible node. Missing IDs are still inferred below as a fallback.
        */

        const suppliedFromEdgeId = String(edge.data("fromEdgeId") || "").trim();
        const suppliedToEdgeId = String(edge.data("toEdgeId") || "").trim();
        const conditionNode = inferredCondition || (edge.data("conditionId")
            ? cy.getElementById(String(edge.data("conditionId"))) : null);
        if (conditionNode && !conditionNode.empty()) {
          const conditionColour = getConditionalNodeColour(conditionNode);
          edge.data({
            conditionId: conditionNode.id(),
            conditionColor: conditionColour,
          });
          const fromProposition = findConditionPropositionEdge(conditionNode, sourceNode.id());
          const toProposition = findConditionPropositionEdge(conditionNode, targetNode.id());
          if (suppliedFromEdgeId) {
            edge.data("fromEdgeId", suppliedFromEdgeId);
          } else if (fromProposition) {
            edge.data("fromEdgeId", fromProposition.id());
          }
          if (suppliedToEdgeId) {
            edge.data("toEdgeId", suppliedToEdgeId);
          } else if (toProposition) {
            edge.data("toEdgeId", toProposition.id());
          }
        } else {
          edge.data("conditionColor", CONDITIONAL_NODE_DEFAULT_COLOR);
        }
      } else {
        edge.removeData("conditionColor");
        edge.removeData("fromEdgeId");
        edge.removeData("toEdgeId");
      }
      edge.data("displayLabel", getEdgeDisplayLabel(edge));
    });
    syncEdgeAnnotationPresentation(cy);
    syncEdgeLabelGeometry(cy);
    cy.style().update();
  }

  function placeConditionalNextToOwner(conditionNode) {
    if (!conditionNode || conditionNode.empty()) {
      return;
    }
    const ownerId = String(conditionNode.data("conditionOwnerId") || "").trim();
    if (!ownerId) {
      return;
    }
    const ownerNode = conditionNode.cy().getElementById(ownerId);
    if (!ownerNode || ownerNode.empty()) {
      return;
    }

    /*
      Re-position the whole owner/condition cluster so multiple conditions
      are stacked neatly instead of fighting for the same coordinates.
    */

    positionSemanticOwnerGroup(ownerNode, conditionNode.cy());
  }

  function applyGraphTheme(cy = cyRef.current) {
    if (!cy) {
      return;
    }
    const graphTheme = getGraphThemeTokens();

    /*
      Conditional borders use a theme-aware automatic default: white in
      dark mode and black in light mode. User-customised borders are left
      untouched.
    */

    syncConditionalDefaultBorders(cy);
    syncImageNodeDefaultTextColours(cy);
    cy.style()
      // =====================================================
      // DEFAULT NODE
      // =====================================================
      .selector("node")
      .style({
        "background-color": graphTheme.nodeBg,
        "border-color": graphTheme.nodeBorder,
        color: graphTheme.nodeText,
      })
      // =====================================================
      // CUSTOM NODE APPEARANCE
      // =====================================================
      .selector("node[color]")
      .style({
        "background-color": "data(color)",
      })
      .selector("node[textColor]")
      .style({
        color: "data(textColor)",
      })
      .selector("node[shape]")
      .style({
        shape: "data(shape)",
      })
      .selector("node[borderColor]")
      .style({
        "border-color": "data(borderColor)",
      })
      .selector("node[borderStyle]")
      .style({
        "border-style": "data(borderStyle)",
      })
      // =====================================================
      // CONDITIONAL NODE
      // =====================================================
      .selector('node[nodeType = "conditional"]')
      .style({
        "background-color": CONDITIONAL_NODE_DEFAULT_COLOR,
      })
      .selector('node[nodeType = "conditional"][conditionColor]')
      .style({
        "background-color": "data(conditionColor)",
      })
      // =====================================================
      // NODE IMAGE FILL
      // =====================================================
      .selector("node[imageSrc]")
      .style({
        "background-image": "data(imageSrc)",
        "background-fit": "cover",
        "background-clip": "node",
        "background-opacity": 1,
        color: getThemeContrastColour(),
      })
      .selector("node[imageSrc][imageFit]")
      .style({
        "background-fit": "data(imageFit)",
      })
      .selector("node[imageSrc][imagePositionX][imagePositionY]")
      .style({
        "background-position-x": "data(imagePositionX)",
        "background-position-y": "data(imagePositionY)",
      })
      .selector("node.image-label-hidden")
      .style({
        label: "",
      })

      /*
        When there is no explicitly chosen border colour, reuse the
        old node fill colour as an accent around the image.
      */

      .selector("node[imageSrc][color]")
      .style({
        "border-color": "data(color)",
        "border-width": 3,
      })
      .selector("node[imageSrc][borderColor]")
      .style({
        "border-color": "data(borderColor)",
      })
      .selector("node[imageSrc][textColor][textColorUserSet]")
      .style({
        color: "data(textColor)",
      })
      // =====================================================
      // INVISIBLE SEMANTIC OWNER COMPOUND
      // =====================================================
      .selector('node[graphInternal = "semantic-owner-group"]')
      .style({
        "background-opacity": 0,
        "border-width": 0,
        "border-opacity": 0,
        label: "",
        "text-opacity": 0,
        padding: 8,
        "compound-sizing-wrt-labels": "exclude",
        "overlay-opacity": 0,
        events: "no",
      })
      // =====================================================
      // SELECTED NODE
      // =====================================================
      .selector("node:selected")
      .style({
        "underlay-color": graphTheme.selectedBorder,
        "underlay-opacity": 0.28,
        "underlay-padding": 10,
      })
      // =====================================================
      // LINKED RAW NOTES HOVER
      // =====================================================
      .selector("node.linked-text-hover")
      .style({
        "underlay-color": "data(linkColor)",
        "underlay-opacity": 0.38,
        "underlay-padding": 20,
      })
      // =====================================================
      // LINK SOURCE
      // =====================================================
      .selector("node.link-source")
      .style({
        "border-width": 4,
        "border-style": "dashed",
        "border-color": graphTheme.linkSource,
        "underlay-color": graphTheme.linkSource,
        "underlay-opacity": 0.22,
        "underlay-padding": 8,
      })
      // =====================================================
      // DEFAULT EDGE
      // =====================================================
      .selector("edge")
      .style({
        width: 2,
        "line-color": graphTheme.edge,
        "target-arrow-color": graphTheme.edgeArrow,
        "target-arrow-shape": "triangle",
        "line-style": "solid",
        "curve-style": "straight",
        "control-point-step-size": 40,
        color: graphTheme.edgeLabel,
        opacity: 0.8,
        label: "data(displayLabel)",
        "font-size": "12px",
        "font-weight": "500",
        "text-margin-x": 0,
        "text-margin-y": -11,
        "text-rotation": "autorotate",
        "text-events": "yes",
      })
      .selector("edge[relationshipMarginX][relationshipMarginY]")
      .style({
        "text-margin-x": "data(relationshipMarginX)",
        "text-margin-y": "data(relationshipMarginY)",
      })
      .selector('edge[labelOrientation = "vertical"]')
      .style({
        "text-rotation": "none",
      })
      // =====================================================
      // CUSTOM EDGE APPEARANCE
      // =====================================================
      .selector("edge[edgeColor]")
      .style({
        "line-color": "data(edgeColor)",
      })
      .selector("edge[arrowColor]")
      .style({
        "target-arrow-color": "data(arrowColor)",
      })
      .selector("edge[arrowShape]")
      .style({
        "target-arrow-shape": "data(arrowShape)",
      })
      .selector("edge[lineStyle]")
      .style({
        "line-style": "data(lineStyle)",
      })
      // =====================================================
      // CONDITIONAL / REIFICATION EDGES
      // =====================================================
      .selector('edge[graphInternal = "condition-owner"]')
      .style({
        width: 0.1,
        opacity: 0,
        "target-arrow-shape": "none",
        label: "",
      })
      .selector("edge[conditionEdge]")
      .style({
        "line-style": "dashed",
      })
      .selector('edge[graphInternal = "edge-qualifier-label"]')
      .style({
        width: 0.1,
        "line-opacity": 0,
        "target-arrow-shape": "none",
        "source-arrow-shape": "none",
        opacity: 1,
        label: "data(displayLabel)",
        color: graphTheme.edgeLabel,
        "text-opacity": 0.62,
        "font-size": "9px",
        "font-weight": "400",
        "text-margin-x": "data(qualifierMarginX)",
        "text-margin-y": "data(qualifierMarginY)",
        "text-rotation": "autorotate",
        events: "no",
      })
      .selector('edge[graphInternal = "edge-qualifier-label"][labelOrientation = "vertical"]')
      .style({
        "text-rotation": "none",
      })
      .selector('edge[graphInternal = "edge-adjunct-label"]')
      .style({
        width: 0.1,
        "line-opacity": 0,
        "target-arrow-shape": "none",
        "source-arrow-shape": "none",
        opacity: 1,
        label: "data(displayLabel)",
        color: graphTheme.adjunctLabel,
        "text-opacity": 0.88,
        "font-size": "9px",
        "font-weight": "500",
        "font-style": "italic",
        "text-margin-x": "data(adjunctMarginX)",
        "text-margin-y": "data(adjunctMarginY)",
        "text-rotation": "autorotate",
        events: "no",
      })
      .selector('edge[graphInternal = "edge-adjunct-label"][labelOrientation = "vertical"]')
      .style({
        "text-rotation": "none",
      })
      .selector('edge[graphInternal = "edge-affirmative-mark"]')
      .style({
        width: 0.1,
        "line-opacity": 0,
        "target-arrow-shape": "none",
        "source-arrow-shape": "none",
        opacity: 1,
        label: "data(displayLabel)",
        color: graphTheme.affirmativeMark,
        "font-size": "16px",
        "font-weight": "800",
        "text-margin-y": 0,
        "text-rotation": "none",
        "text-outline-color": "#111827",
        "text-outline-width": 2,
        events: "no",
      })
      .selector('edge[graphInternal = "edge-negative-mark"]')
      .style({
        width: 0.1,
        "line-opacity": 0,
        "target-arrow-shape": "none",
        "source-arrow-shape": "none",
        opacity: 1,
        label: "data(displayLabel)",
        color: graphTheme.negativeMark,
        "font-size": "16px",
        "font-weight": "800",
        "text-margin-y": 0,
        "text-rotation": "none",
        "text-outline-color": "#111827",
        "text-outline-width": 2,
        events: "no",
      })
      .selector('edge[resolvedEdgeRole = "reification"]')
      .style({
        width: 4,
        "line-color": CONDITIONAL_NODE_DEFAULT_COLOR,
        "target-arrow-color": CONDITIONAL_NODE_DEFAULT_COLOR,
        "target-arrow-shape": "triangle",
        "line-style": "solid",
        "arrow-scale": 1.25,
        color: CONDITIONAL_NODE_DEFAULT_COLOR,
        "font-weight": "bold",
        opacity: 1,
      })
      .selector('edge[resolvedEdgeRole = "reification"][conditionColor]')
      .style({
        "line-color": "data(conditionColor)",
        "target-arrow-color": "data(conditionColor)",
        color: "data(conditionColor)",
      })

      // =====================================================
      // SELECTED EDGE
      // Must come AFTER custom edge styles.
      // =====================================================
      .selector("edge:selected")
      .style({
        "underlay-color": graphTheme.selectedEdge,
        "underlay-opacity": 0.32,
        "underlay-padding": 6,
      })
      .update();
  }
  // =========================================================
  // CYTOSCAPE INITIALISATION
  // Create Cytoscape once and keep the instance alive.
  // =========================================================
  useEffect(() => {
    if (!graphContainerRef.current || cyRef.current) {
      return;
    }
    const graphTheme = getGraphThemeTokens();
    const cy = cytoscape({
      container: graphContainerRef.current,
      elements: [],

      /*
        Start with an empty graph.

        Saved graphs, AI graphs and streamed graph
        elements will be inserted separately.
      */

      selectionType: "additive",
      minZoom: 0.25,
      maxZoom: 1.5,

      /*
        There is nothing to arrange yet.

        A layout will be run after graph elements
        are loaded or streamed.
      */

      layout: {
        name: "preset",
      },
      style: [

        /* =====================================================
          NORMAL NODE
          ===================================================== */

        {
          selector: "node",
          style: {
            "background-color": graphTheme.nodeBg,
            width: 110,
            height: 52,
            shape: "round-rectangle",
            label: "data(label)",
            color: graphTheme.nodeText,
            "font-size": "15px",
            "font-weight": "500",
            "font-family": "Inter, system-ui, sans-serif",
            "text-valign": "center",
            "text-halign": "center",
            "text-wrap": "wrap",
            "text-max-width": "75px",
            "text-overflow-wrap": "whitespace",
            "text-justification": "center",
            "line-height": 1.15,
            "border-width": 2,
            "border-color": graphTheme.nodeBorder,
            "overlay-opacity": 0,
          },
        },

        /* =====================================================
          DYNAMIC NODE SIZE
          ===================================================== */

        {
          selector: "node[nodeWidth][nodeHeight]",
          style: {
            width: "data(nodeWidth)",
            height: "data(nodeHeight)",
            "text-max-width": "data(nodeTextMaxWidth)",
            "text-margin-y": "data(nodeTextMarginY)",
          },
        },

        /* =====================================================
          INVISIBLE SEMANTIC OWNER COMPOUND
          ===================================================== */

        {
          selector: 'node[graphInternal = "semantic-owner-group"]',
          style: {
            "background-opacity": 0,
            "border-width": 0,
            "border-opacity": 0,
            label: "",
            "text-opacity": 0,
            padding: 8,
            "compound-sizing-wrt-labels": "exclude",
            "overlay-opacity": 0,
            events: "no",
          },
        },

        /* =====================================================
          SAVED NODE BORDER COLOUR
          ===================================================== */

        {
          selector: "node[borderColor]",
          style: {
            "border-color": "data(borderColor)",
          },
        },

        /* =====================================================
          SAVED NODE BORDER STYLE
          ===================================================== */

        {
          selector: "node[borderStyle]",
          style: {
            "border-style": "data(borderStyle)",
          },
        },

        /*
          ========================================================= SELECTED NODE
          =========================================================

          Solid outline.

          This intentionally does NOT change
          the node's actual background colour.
        */

        {
          selector: "node:selected",
          style: {
            "underlay-color": graphTheme.selectedBorder,
            "underlay-opacity": 0.28,
            "underlay-padding": 10,
          },
        },

        /* =========================================================
          LINKED RAW NOTES HOVER
          ========================================================= */

        {
          selector: "node.linked-text-hover",
          style: {
            "underlay-color": "data(linkColor)",
            "underlay-opacity": 0.38,
            "underlay-padding": 20,
          },
        },

        /*
          ========================================================= LINK SOURCE NODE
          =========================================================

          Dashed outline gives us an additional
          non-colour accessibility cue.
        */

        {
          selector: "node.link-source",
          style: {
            "border-width": 4,
            "border-style": "dashed",
            "border-color": graphTheme.linkSource,
            "overlay-color": graphTheme.linkSource,
            "overlay-opacity": 0.22,
            "overlay-padding": 8,
          },
        },

        /* =====================================================
          SAVED CUSTOM NODE COLOUR
          ===================================================== */

        {
          selector: "node[color]",
          style: {
            "background-color": "data(color)",
          },
        },
        {
          selector: "node[textColor]",
          style: {
            color: "data(textColor)",
          },
        },

        /* =====================================================
          SAVED NODE SHAPE
          ===================================================== */

        {
          selector: "node[shape]",
          style: {
            shape: "data(shape)",
          },
        },

        /* =====================================================
          CONDITIONAL NODE
          ===================================================== */

        {
          selector: 'node[nodeType = "conditional"]',
          style: {
            "background-color": CONDITIONAL_NODE_DEFAULT_COLOR,
          },
        },
        {
          selector: 'node[nodeType = "conditional"][conditionColor]',
          style: {
            "background-color": "data(conditionColor)",
          },
        },

        /* =====================================================
          NODE IMAGE FILL
          ===================================================== */

        {
          selector: "node[imageSrc]",
          style: {
            "background-image": "data(imageSrc)",
            "background-fit": "cover",
            "background-clip": "node",
            "background-opacity": 1,
            color: getThemeContrastColour(),
          },
        },
        {
          selector: "node[imageSrc][imageFit]",
          style: {
            "background-fit": "data(imageFit)",
          },
        },
        {
          selector: "node.image-label-hidden",
          style: {
            label: "",
          },
        },
        {
          selector: "node[imageSrc][color]",
          style: {
            "border-color": "data(color)",
            "border-width": 3,
          },
        },
        {
          selector: "node[imageSrc][borderColor]",
          style: {
            "border-color": "data(borderColor)",
          },
        },
        {
          selector: "node[imageSrc][textColor][textColorUserSet]",
          style: {
            color: "data(textColor)",
          },
        },

        /* =====================================================
          DEFAULT EDGE
          ===================================================== */

        {
          selector: "edge",
          style: {
            width: 2,
            "line-color": graphTheme.edge,
            "target-arrow-color": graphTheme.edgeArrow,
            "target-arrow-shape": "triangle",
            "curve-style": "straight",
            "control-point-step-size": 40,
            opacity: 0.8,
            "arrow-scale": 1.1,

            /*
              Relationship label
            */

            label: "data(displayLabel)",
            color: graphTheme.edgeLabel,
            "font-size": "12px",
            "font-weight": "500",
            "text-wrap": "none",
            "text-overflow-wrap": "whitespace",

            /*
              Lift the label slightly above the edge
              rather than drawing the line through it.
            */

            "text-margin-x": 0,
            "text-margin-y": -11,

            /*
              Keep relationship text parallel to the edge.
            */

            "text-rotation": "autorotate",

            /*
              Allows clicking/double-clicking the
              label itself to count as interacting
              with the edge.
            */

            "text-events": "yes",
          },
        },
        {
          selector: "edge[relationshipMarginX][relationshipMarginY]",
          style: {
            "text-margin-x": "data(relationshipMarginX)",
            "text-margin-y": "data(relationshipMarginY)",
          },
        },
        {
          selector: 'edge[labelOrientation = "vertical"]',
          style: {
            "text-rotation": "none",
          },
        },

        /*
          ========================================================= CUSTOM EDGE COLOUR
          =========================================================
        */

        {
          selector: "edge[edgeColor]",
          style: {
            "line-color": "data(edgeColor)",
          },
        },

        /*
          ========================================================= CUSTOM ARROW COLOUR
          =========================================================
        */

        {
          selector: "edge[arrowColor]",
          style: {
            "target-arrow-color": "data(arrowColor)",
          },
        },

        /*
          ========================================================= CUSTOM ARROW SHAPE
          =========================================================
        */

        {
          selector: "edge[arrowShape]",
          style: {
            "target-arrow-shape": "data(arrowShape)",
          },
        },

        /*
          ========================================================= CUSTOM EDGE STYLE
          =========================================================
        */

        {
          selector: "edge[lineStyle]",
          style: {
            "line-style": "data(lineStyle)",
          },
        },

        /* =====================================================
          CONDITIONAL / REIFICATION EDGES
          ===================================================== */

        {
          selector: 'edge[graphInternal = "condition-owner"]',
          style: {
            width: 0.1,
            opacity: 0,
            "target-arrow-shape": "none",
            label: "",
          },
        },
        {
          selector: "edge[conditionEdge]",
          style: {
            "line-style": "dashed",
          },
        },
        {
          selector: 'edge[graphInternal = "edge-qualifier-label"]',
          style: {
            width: 0.1,
            "line-opacity": 0,
            "target-arrow-shape": "none",
            "source-arrow-shape": "none",
            opacity: 1,
            label: "data(displayLabel)",
            color: graphTheme.edgeLabel,
            "text-opacity": 0.62,
            "font-size": "9px",
            "font-weight": "400",
            "text-margin-x": "data(qualifierMarginX)",
            "text-margin-y": "data(qualifierMarginY)",
            "text-rotation": "autorotate",
            events: "no",
          },
        },
        {
          selector: 'edge[graphInternal = "edge-qualifier-label"][labelOrientation = "vertical"]',
          style: {
            "text-rotation": "none",
          },
        },
        {
          selector: 'edge[graphInternal = "edge-affirmative-mark"]',
          style: {
            width: 0.1,
            "line-opacity": 0,
            "target-arrow-shape": "none",
            "source-arrow-shape": "none",
            opacity: 1,
            label: "data(displayLabel)",
            color: graphTheme.affirmativeMark,
            "font-size": "16px",
            "font-weight": "800",
            "text-margin-y": 0,
            "text-rotation": "none",
            "text-outline-color": "#111827",
            "text-outline-width": 2,
            events: "no",
          },
        },
        {
          selector: 'edge[graphInternal = "edge-negative-mark"]',
          style: {
            width: 0.1,
            "line-opacity": 0,
            "target-arrow-shape": "none",
            "source-arrow-shape": "none",
            opacity: 1,
            label: "data(displayLabel)",
            color: graphTheme.negativeMark,
            "font-size": "16px",
            "font-weight": "800",
            "text-margin-y": 0,
            "text-rotation": "none",
            "text-outline-color": "#111827",
            "text-outline-width": 2,
            events: "no",
          },
        },
        {
          selector: 'edge[resolvedEdgeRole = "reification"]',
          style: {
            width: 4,
            "line-color": CONDITIONAL_NODE_DEFAULT_COLOR,
            "target-arrow-color": CONDITIONAL_NODE_DEFAULT_COLOR,
            "target-arrow-shape": "triangle",
            "line-style": "solid",
            "arrow-scale": 1.25,
            color: CONDITIONAL_NODE_DEFAULT_COLOR,
            "font-weight": "bold",
            opacity: 1,
          },
        },
        {
          selector: 'edge[resolvedEdgeRole = "reification"][conditionColor]',
          style: {
            "line-color": "data(conditionColor)",
            "target-arrow-color": "data(conditionColor)",
            color: "data(conditionColor)",
          },
        },

        /* =====================================================
          ACTIVE NODE
          ===================================================== */

        {
          selector: "node:active",
          style: {
            "overlay-opacity": 0.08,
          },
        },

        /*
          ========================================================= SELECTED EDGE
          =========================================================

          Selected edges become both coloured
          AND thicker.
        */

        {
          selector: "edge:selected",
          style: {
            "underlay-color": graphTheme.selectedEdge,
            "underlay-opacity": 0.32,
            "underlay-padding": 6,
          },
        },
      ],
    });
    cyRef.current = cy;

    /*
      Size every node after the graph has been
      created or loaded.
    */

    cy.nodes().forEach(node => {
      resizeNodeToLabel(node);
    });
    cy.style().update();

    /* =========================================================
      WATCH TREE NOTES THEME / ACCESSIBILITY CHANGES
      ========================================================= */

    const themeObserver = new MutationObserver((mutations) => {
      const themeChanged = mutations.some((mutation) => mutation.attributeName === "data-theme" ||
        mutation.attributeName === "data-color-vision");
      if (!themeChanged) {
        return;
      }
      applyGraphTheme(cy);

      /*
        Keep the Selected Node toolbar colour
        consistent with the newly active theme
        when the node does not have a custom colour.
      */

      setSelectedNode((current) => {
        if (!current) {
          return current;
        }
        const currentCyNode = cy.getElementById(current.id);
        if (!currentCyNode || currentCyNode.empty()) {
          return current;
        }
        const savedColour = currentCyNode.data("color");
        return {
          ...current,
          color: savedColour || getThemeColour("--graph-node-bg", "#6366F1"),
          borderColor: currentCyNode.data("borderColor") || getThemeColour("--graph-node-border", "#818CF8"),
        };
      });
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [
        "data-theme",
        "data-color-vision",
      ],
    });
    // =========================================================
    // DOUBLE CLICK NODE = RENAME NODE
    // =========================================================
    cy.on("dbltap", "node", (event) => {
      const node = event.target;
      const position = node.renderedPosition();
      const zoom = cy.zoom();
      cy.elements().unselect();
      node.select();
      setSelectedNode({
        ...node.data(),
        color: node.data("color") || getThemeColour("--graph-node-bg", "#6366F1"),
        textColor: node.data("textColor") || getThemeColour("--graph-node-text", "#ffffff"),
        shape: node.data("shape") || "round-rectangle",
      });
      setSelectedEdge(null);
      const currentLabel = node.data("label") || "";
      renameOriginalValueRef.current = currentLabel;
      setRenameValue(currentLabel);
      const textMarginY = Number(node.data("nodeTextMarginY")) || 0;
      setRenamePosition({
        x: position.x,

        /*
          renderedPosition() is already in screen
          coordinates, while nodeTextMarginY is in
          graph coordinates, so scale it by zoom.
        */

        y: position.y +
          textMarginY * zoom,
      });
      setRenameZoom(zoom);

      /*
        Hide Cytoscape's painted text while
        the HTML text field sits over it.
      */

      node.style("text-opacity", 0);
      editingNodeIdRef.current = node.id();
      setEditingNodeId(node.id());
    });
    // =========================================================
    // DOUBLE CLICK EDGE = EDIT RELATIONSHIP
    // =========================================================
    cy.on("dbltap", "edge", (event) => {

      /*
        Don't start relationship editing while
        the user is actively creating a link.
      */

      if (linkModeRef.current) {
        return;
      }
      const edge = event.target;
      const sourceNode = edge.source();
      const targetNode = edge.target();
      const midpoint = edge.renderedMidpoint();
      const currentRelationship = edge.data("relationship") || "";

      /*
        Keep normal graph selection synchronised.
      */

      cy.elements().unselect();
      edge.select();
      setSelectedEdge({
        ...edge.data(),
        sourceLabel: sourceNode.data("label") || sourceNode.id(),
        targetLabel: targetNode.data("label") || targetNode.id(),
      });
      setSelectedNode(null);
      setShapeMenuOpen(false);
      setNodeBorderStyleMenuOpen(false);
      setEdgeStyleMenuOpen(false);
      setArrowShapeMenuOpen(false);
      setGraphColorPicker(null);

      /*
        Store existing value so Escape can
        effectively leave it unchanged.
      */

      relationshipOriginalValueRef.current = currentRelationship;
      setRelationshipValue(currentRelationship);
      setRelationshipPosition({
        x: midpoint.x,
        y: midpoint.y,
      });
      setRelationshipZoom(cy.zoom());

      /*
        Hide Cytoscape's normal painted label
        while our editable field is on top.
      */

      edge.style("text-opacity", 0);
      editingEdgeIdRef.current = edge.id();
      setEditingEdgeId(edge.id());
    });
    // =========================================================
    // NODE SELECTION
    // =========================================================
    cy.on("tap", "node", (event) => {
      const clickedNode = event.target;
      const shiftPressed = Boolean(event.originalEvent?.shiftKey);

      /*
        SHIFT + click toggles this node while preserving
        the rest of the current selection.

        Normal click returns to single-selection behaviour.
      */

      if (shiftPressed && !linkModeRef.current) {

        /*
          selectionType: "additive" has already toggled
          the Cytoscape selection for us.

          Wait until Cytoscape has fully settled the
          selection, then synchronise React state.
        */

        requestAnimationFrame(() => {
          syncGraphSelectionState(clickedNode);
          console.log("Graph multi-selection:", cy.$(":selected").length, "elements");
        });
        setShapeMenuOpen(false);
        setNodeBorderStyleMenuOpen(false);
        setEdgeStyleMenuOpen(false);
        setArrowShapeMenuOpen(false);
        setGraphColorPicker(null);
        return;
      }

      /*
        Cytoscape now uses additive selection.

        Wait until its own click handling has completed,
        then deliberately normalise a plain click back to
        exactly one selected element.
      */

      requestAnimationFrame(() => {

        /*
          The element might theoretically have disappeared
          before this frame, so guard against that.
        */

        if (!cyRef.current || clickedNode.removed()) {
          return;
        }
        cy.elements().unselect();
        clickedNode.select();

        /*
          React state + selectionSummary are now built
          from Cytoscape's final selection state.
        */

        syncGraphSelectionState(clickedNode);
      });
      setShapeMenuOpen(false);
      setNodeBorderStyleMenuOpen(false);
      setEdgeStyleMenuOpen(false);
      setArrowShapeMenuOpen(false);
      setGraphColorPicker(null);
      // =====================================================
      // NORMAL NODE SELECTION
      // =====================================================
      if (!linkModeRef.current) {
        console.log("Selected node:", clickedNode.data());
        return;
      }
      // =====================================================
      // LINK MODE: SELECT FIRST NODE
      // =====================================================
      if (!firstNodeToLinkRef.current) {
        firstNodeToLinkRef.current = clickedNode.id();
        setFirstNodeToLink(clickedNode.id());
        clickedNode.addClass("link-source");
        console.log("First node selected for link:", clickedNode.data("label"));
        return;
      }
      // =====================================================
      // PREVENT SELF LINK
      // =====================================================
      if (firstNodeToLinkRef.current === clickedNode.id()) {
        return;
      }
      // =====================================================
      // CREATE LINK
      // =====================================================
      const sourceId = firstNodeToLinkRef.current;
      const targetId = clickedNode.id();
      const sourceNode = cy.getElementById(sourceId);
      const sourceLabel = sourceNode.data("label") || sourceId;
      const targetLabel = clickedNode.data("label") || targetId;
      const edgeId = `manual-edge-${Date.now()}`;
      cy.add({
        group: "edges",
        data: {
          id: edgeId,
          source: sourceId,
          target: targetId,
          relationship: "",
          qualifier: "",
          classification: "",

          /*
            Manual edges start in Auto mode. If both endpoints
            are proposition targets of the same conditional node,
            TreeNotes will render this as a reification edge.
          */

          edgeRole: "auto",
        },
      });
      syncConditionalGraphSemantics(cy);
      sourceNode.removeClass("link-source");
      linkModeRef.current = false;
      firstNodeToLinkRef.current = null;
      setLinkMode(false);
      setFirstNodeToLink(null);
      showGraphFeedback(`Link created: ${sourceLabel} → ${targetLabel}`, "success");
    });
    // =========================================================
    // EDGE SELECTION
    // =========================================================
    cy.on("tap", "edge", (event) => {
      const clickedEdge = event.target;
      const shiftPressed = Boolean(event.originalEvent?.shiftKey);

      /*
        SHIFT + click toggles this edge without
        disturbing nodes or other selected edges.
      */

      if (shiftPressed) {
        requestAnimationFrame(() => {
          syncGraphSelectionState(clickedEdge);
          console.log("Graph multi-selection:", cy.$(":selected").length, "elements");
        });
        setShapeMenuOpen(false);
        setNodeBorderStyleMenuOpen(false);
        setEdgeStyleMenuOpen(false);
        setArrowShapeMenuOpen(false);
        setGraphColorPicker(null);
        return;
      }
      requestAnimationFrame(() => {
        if (!cyRef.current || clickedEdge.removed()) {
          return;
        }
        cy.elements().unselect();
        clickedEdge.select();
        syncGraphSelectionState(clickedEdge);
      });
      setShapeMenuOpen(false);
      setNodeBorderStyleMenuOpen(false);
      setEdgeStyleMenuOpen(false);
      setArrowShapeMenuOpen(false);
      setGraphColorPicker(null);
      console.log("Selected edge:", clickedEdge.data());
    });
    // =========================================================
    // BACKGROUND CLICK = DESELECT EVERYTHING
    // =========================================================
    cy.on("tap", (event) => {

      /*
        Cytoscape core itself is the event target
        when the empty graph background is clicked.

        Node and edge taps also bubble through here,
        so only clear selection when target === cy.
      */

      if (event.target !== cy) {
        return;
      }
      cy.elements().unselect();
      setSelectedNode(null);
      setSelectedEdge(null);
      setSelectionSummary({
        nodes: [],
        edges: [],
      });
      setShapeMenuOpen(false);
      setNodeBorderStyleMenuOpen(false);
      setEdgeStyleMenuOpen(false);
      setArrowShapeMenuOpen(false);
      setGraphColorPicker(null);
      console.log("Graph selection cleared");
    });

    /* =========================================================
       KEEP INLINE NODE RENAME SYNCED WITH GRAPH
       ========================================================= */

    function syncRenameOverlay() {
      const nodeId = editingNodeIdRef.current;
      if (!nodeId) {
        return;
      }
      const node = cy.getElementById(nodeId);
      if (!node || node.empty()) {
        return;
      }
      const position = node.renderedPosition();
      const zoom = cy.zoom();
      const textMarginY = Number(node.data("nodeTextMarginY")) || 0;
      setRenamePosition({
        x: position.x,
        y: position.y +
          textMarginY * zoom,
      });
      setRenameZoom(cy.zoom());
    }

    /* =========================================================
       KEEP EDGE RELATIONSHIP EDITOR SYNCED WITH GRAPH
       ========================================================= */

    function syncRelationshipOverlay() {
      const edgeId = editingEdgeIdRef.current;
      if (!edgeId) {
        return;
      }
      const edge = cy.getElementById(edgeId);
      if (!edge || edge.empty()) {
        return;
      }
      const midpoint = edge.renderedMidpoint();
      setRelationshipPosition({
        x: midpoint.x,
        y: midpoint.y,
      });
      setRelationshipZoom(cy.zoom());
    }

    /*
      Keep the HTML rename field aligned with the
      Cytoscape node while zooming or panning.
    */

    cy.on("zoom pan", syncRenameOverlay);
    cy.on("zoom pan", syncRelationshipOverlay);
    cy.on("drag position", "node", () => {
      /*
        Keep overlays attached during drag, but do not run any graph-wide
        geometry optimiser here.  Dragging must remain a cheap interaction.
      */
      syncRelationshipOverlay();
    });

    /*
      Keep it aligned if the node itself is dragged
      while it is being renamed.
    */

    cy.on("drag", "node", (event) => {
      if (event.target.id() === editingNodeIdRef.current) {
        syncRenameOverlay();
      }

      /*
        Dragging a semantic owner moves its conditional companions with it.
        The invisible compound keeps them structurally grouped, while this
        small positional rule preserves the clean side-by-side mind-map look.
      */

      if (!event.target.data("graphInternal") &&
        normaliseNodeType(event.target.data("nodeType"), event.target.data("conditionOwnerId")) !== "conditional") {
        /*
          Owner drag uses the already chosen condition offsets.  Crossing-aware
          slot scoring is deliberately reserved for automatic layout only.
        */
        placeConditionsFromSavedOffsets(event.target, cy);
      }
    });
    cy.on("free", "node", (event) => {
      if (event.target.data("graphInternal")) {
        return;
      }
      const releasedNode = event.target;
      const releasedIsConditional = normaliseNodeType(releasedNode.data("nodeType"), releasedNode.data("conditionOwnerId")) === "conditional";
      if (releasedIsConditional) {
        const ownerId = String(releasedNode.data("conditionOwnerId") || "").trim();
        const ownerNode = ownerId ? cy.getElementById(ownerId) : null;

        /*
          Do not snap a conditional back to its automatic slot. Capture the
          user's new offset instead. Moving the owner later will preserve this
          relative placement, giving the cluster a flexible mind-map feel.
        */

        if (ownerNode && !ownerNode.empty()) {
          const conditionPosition = releasedNode.position();
          const ownerPosition = ownerNode.position();
          releasedNode.data({
            conditionPlacement: "manual",
            conditionOffsetX: conditionPosition.x -
              ownerPosition.x,
            conditionOffsetY: conditionPosition.y -
              ownerPosition.y,
          });
        }
      } else {

        /*
          If the semantic owner itself moved, keep all conditional companions
          at their saved automatic/manual offsets around it.
        */

        placeConditionsFromSavedOffsets(releasedNode, cy);
      }
      syncRelationshipOverlay();
      syncEdgeLabelGeometry(cy);
    });
    // =========================================================
    // DOUBLE CLICK NODE = RENAME NODE
    // =========================================================
    let parallelRouteFrame = null;
    const resyncParallelEdgeRouting = () => {
      if (parallelRouteFrame !== null) {
        cancelAnimationFrame(parallelRouteFrame);
      }

      parallelRouteFrame = requestAnimationFrame(() => {
        parallelRouteFrame = null;

        if (!cy || cy.destroyed()) return;

        syncParallelEdgeRouting(cy);
        syncEdgeLabelGeometry(cy);
      });
    };

    cy.on("add", "edge", resyncParallelEdgeRouting);
    cy.on("remove", "edge", resyncParallelEdgeRouting);
    return () => {
      cy.off("add", "edge", resyncParallelEdgeRouting);
      cy.off("remove", "edge", resyncParallelEdgeRouting);
      if (parallelRouteFrame !== null) {
        cancelAnimationFrame(parallelRouteFrame);
      }
      themeObserver.disconnect();
      cy.destroy();
      cyRef.current = null;
    };
  }, []);
  // =========================================================
  // LOAD GRAPH DATA INTO EXISTING CYTOSCAPE INSTANCE
  // =========================================================
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) {
      return;
    }
    const nodes = Array.isArray(graphData?.nodes) ? graphData.nodes.map(nodeElement => {
        const rawData = nodeElement?.data ?? nodeElement ?? {};
        return nodeElement?.data ? {
            ...nodeElement,
            data: normaliseIncomingNodeData(rawData),
          } : {
            group: "nodes",
            data: normaliseIncomingNodeData(rawData),
          };
      }) : [];
    const rawEdges = Array.isArray(graphData?.edges) ? graphData.edges : [];
    const edgeMap = new Map();
    rawEdges.forEach(edgeElement => {
      const rawData = edgeElement?.data ?? edgeElement ?? {};
      expandIncomingEdgeData(rawData).forEach(expandedData => {
        const edgeId = String(expandedData.id ||
          `loaded-edge-${expandedData.source}-${expandedData.target}-${expandedData.relationship || "link"}`);
        edgeMap.set(edgeId, edgeElement?.data ? {
            ...edgeElement,
            group: "edges",
            data: {
              ...expandedData,
              id: edgeId,
            },
          } : {
            group: "edges",
            data: {
              ...expandedData,
              id: edgeId,
            },
          });
      });
    });
    const edges = Array.from(edgeMap.values());

    /*
      Determine whether this graph came from the database
      with saved node positions.
    */

    const hasSavedPositions = nodes.length > 0 && nodes.every((node) => Number.isFinite(node?.position?.x) &&
        Number.isFinite(node?.position?.y));

    /*
      Replace the currently displayed graph without
      destroying Cytoscape itself.
    */

    cy.batch(() => {
      cy.elements().remove();
      if (nodes.length > 0 || edges.length > 0) {
        cy.add([
          ...nodes,
          ...edges,
        ]);
      }
    });

    /*
      Apply TreeNotes node auto-sizing to newly
      inserted nodes.
    */

    cy.nodes().forEach((node) => {
      resizeNodeToLabel(node);
      syncImageNodePresentation(node);
    });
    syncConditionalGraphSemantics(cy);
    applyGraphTheme(cy);
    cy.style().update();

    /*
      Nothing else needs doing for an empty graph.
    */

    if (cy.elements().empty()) {
      return;
    }

    /*
      Saved graphs retain their exact user positions. Fresh AI graphs use the
      same compact semantic-only COSE pass as streamed generation.
    */

    if (hasSavedPositions) {
      cy.resize();
      positionAllSemanticOwnerGroups(cy);
      syncEdgeLabelGeometry(cy);
      fitVisibleGraph(cy, 50);
      return;
    }

    runCompactGraphLayout(cy, {
      animate: true,
      padding: 50,
      randomize: true,
    });
  }, [graphData]);

  function addSelectedTextNode() {
    if (!cyRef.current || !selectedText) {
      return;
    }
    const cy = cyRef.current;
    const nodeAlreadyExists = cy.nodes().some((node) => {
      return (node.data("label")?.trim().toLowerCase() === selectedText.trim().toLowerCase());
    });
    if (nodeAlreadyExists) {
      console.log("Node already exists:", selectedText);
      return;
    }
    const newNodeId = typeof crypto.randomUUID === "function" ? `manual-${crypto.randomUUID()}`
      : `manual-${Date.now()}-${Math.random()}`;
    const extent = cy.extent();
    const centreX = (extent.x1 + extent.x2) / 2;
    const centreY = (extent.y1 + extent.y2) / 2;
    const newNode = cy.add({
      group: "nodes",
      data: {
        id: newNodeId,
        label: selectedText,
        nodeType: "standard",
      },
      position: {
        x: centreX + 60,
        y: centreY + 60,
      },
    });
    resizeNodeToLabel(newNode);
  }
  useEffect(() => {
    if (addNodeTrigger === 0) {
      return;
    }
    addSelectedTextNode();
  }, [addNodeTrigger]);
  // getting latest graph with all the chnages
  function getEditedGraphData({ includeNodeImages = true, } = {}) {
    if (!cyRef.current) {
      return null;
    }
    const cy = cyRef.current;
    const nodes = cy.nodes()
      .filter(node => !node.data("graphInternal"))
      .map((node) => {
        const data = {
          ...node.data(),
        };

        /*
          Older builds could attach renderer-only semantic compound parents.
          Never persist those IDs in graph_json. conditionOwnerId remains the
          semantic source of truth for owner-relative condition placement.
        */

        delete data.parent;
        delete data.graphInternal;

        /*
          Semantic graph search only needs conceptual graph data.
          Never send large base64 image payloads to the embedding/search
          endpoint. Saving still uses the default includeNodeImages=true.
        */

        if (!includeNodeImages) {
          delete data.imageSrc;
          delete data.imageMime;
          delete data.imageName;
          delete data.imageWidth;
          delete data.imageHeight;
          delete data.imageOriginalWidth;
          delete data.imageOriginalHeight;
          delete data.imageStoredBytes;
          delete data.imageFit;
        }
        return {
          data,
          position: {
            x: node.position("x"),
            y: node.position("y"),
          },
        };
      });
    const edges = cy.edges()
      .filter(edge => !edge.data("graphInternal"))
      .map((edge) => {
        const data = {
          ...edge.data(),
        };

        /*
          These fields are renderer/layout derivatives. Rebuild them
          when the graph loads so saved JSON remains semantic and clean.
        */

        delete data.displayLabel;
        delete data.resolvedEdgeRole;
        delete data.resolvedClassification;
        delete data.conditionColor;
        delete data.conditionEdge;
        delete data.graphInternal;
        return {
          data,
        };
      });
    return {
      nodes,
      edges,
    };
  }

  /*
    Graph persistence is handled by NoteWorkspace.saveEverything().
    That keeps title, Raw Notes, rich HTML, summary and graph_json
    inside one atomic PATCH request.
  */

  function startLinkMode() {

    /*
      Clicking the active Link button
      again cancels link mode.
    */

    if (linkModeRef.current) {
      cancelLinkMode();
      return;
    }
    cyRef.current ?.nodes()
      .removeClass("link-source");
    linkModeRef.current = true;
    firstNodeToLinkRef.current = null;
    setLinkMode(true);
    setFirstNodeToLink(null);
    setGraphFeedback(null);
  }

  function cancelLinkMode() {
    cyRef.current ?.nodes()
      .removeClass("link-source");
    linkModeRef.current = false;
    firstNodeToLinkRef.current = null;
    setLinkMode(false);
    setFirstNodeToLink(null);
  }

  function createLinkedTextNode(label, linkColor) {
    if (!cyRef.current || !label?.trim()) {
      return null;
    }
    const cy = cyRef.current;

    /*
      If this concept already exists, link to the
      existing node instead of making a duplicate.
    */

    const existingNodes = cy.nodes().filter((node) => {
      return (node.data("label")?.trim().toLowerCase() === label.trim().toLowerCase());
    });
    if (existingNodes.length > 0) {
      const existingNode = existingNodes[0];
      existingNode.data("linkColor", linkColor);
      return existingNode.id();
    }
    const newNodeId = typeof crypto.randomUUID === "function" ? `manual-${crypto.randomUUID()}`
      : `manual-${Date.now()}`;
    const extent = cy.extent();
    const centreX = (extent.x1 + extent.x2) / 2;
    const centreY = (extent.y1 + extent.y2) / 2;
    const newNode = cy.add({
      group: "nodes",
      data: {
        id: newNodeId,
        label: label,
        nodeType: "standard",
      },
      position: {
        x: centreX + 60,
        y: centreY + 60,
      },
    });
    resizeNodeToLabel(newNode);
    return newNodeId;
  }

  function focusNode(nodeId) {
    if (!cyRef.current) {
      return false;
    }
    const cy = cyRef.current;
    const node = cy.getElementById(nodeId);
    if (!node || node.empty()) {
      return false;
    }

    /*
      Linked Raw Notes navigation is a real graph selection, not
      just a viewport focus. Keep the newer selectionSummary state
      in sync as well as Cytoscape itself so the selection panel
      appears exactly as it does after clicking the node directly.
    */
    cy.elements().unselect();
    node.select();
    syncGraphSelectionState(node);

    setShapeMenuOpen(false);
    setNodeBorderStyleMenuOpen(false);
    setEdgeStyleMenuOpen(false);
    setArrowShapeMenuOpen(false);
    setGraphColorPicker(null);
    cy.animate({
      center: {
        eles: node,
      },
      zoom: Math.max(cy.zoom(), 1.35),
    }, {
      duration: 350,
    });
    return true;
  }

  function setLinkedNodeHover(nodeId, color, isHovered) {
    if (!cyRef.current) {
      return;
    }
    const node = cyRef.current.getElementById(nodeId);
    if (!node || node.empty()) {
      return;
    }
    if (isHovered) {
      node.data("linkColor", color);

      /*
        Use a class instead of direct style overrides.

        This allows normal selected styling to return
        automatically after hover ends.
      */

      node.addClass("linked-text-hover");
    } else {
      node.removeClass("linked-text-hover");
    }
  }

  function setLinkedNodeColor(nodeId, color) {
    if (!cyRef.current) {
      return;
    }
    const node = cyRef.current.getElementById(nodeId);
    if (!node || node.empty()) {
      return;
    }
    node.data("linkColor", color);

    /*
      If the node is currently being hovered,
      Cytoscape automatically refreshes the
      linked-text-hover halo from data(linkColor).
    */

    node.updateStyle();
  }

  function getSelectedCyNodes() {
    if (!cyRef.current) {
      return null;
    }
    const nodes = cyRef.current.nodes(":selected");
    return (nodes.length > 0 ? nodes : null);
  }

  function getSelectedCyEdges() {
    if (!cyRef.current) {
      return null;
    }
    const edges = cyRef.current.edges(":selected");
    return (edges.length > 0 ? edges : null);
  }

  function buildSelectedNodeData(node) {
    if (!node || node.empty()) {
      return null;
    }
    return {
      ...node.data(),
      color: node.data("color") || getThemeColour("--graph-node-bg", "#6366F1"),
      textColor: node.data("textColor") || getThemeColour("--graph-node-text", "#ffffff"),
      shape: node.data("shape") || "round-rectangle",
    };
  }

  function buildSelectedEdgeData(edge) {
    if (!edge || edge.empty()) {
      return null;
    }
    const sourceNode = edge.source();
    const targetNode = edge.target();
    return {
      ...edge.data(),
      adjuncts: normaliseEdgeAdjuncts(edge.data("adjuncts")),
      sourceLabel: sourceNode.data("label") || sourceNode.id(),
      targetLabel: targetNode.data("label") || targetNode.id(),
    };
  }

  function getReificationProposition(cy, endpointNode, conditionId) {
    if (!cy || !endpointNode || endpointNode.empty?.() || !conditionId) {
      return null;
    }

    /*
      Find proposition edges in the same conditional scope
      that terminate at this endpoint.

      Example:

        When temperatures fall -> Shelter
               seeks

      For the reification edge:

        Shelter -> Body heat
               allowing
    */

    const matchingEdges = cy
      .edges()
      .filter((candidate) => {
        if (isInternalConditionOwnerEdge(candidate)) {
          return false;
        }
        const candidateRole = candidate.data("resolvedEdgeRole") || normaliseEdgeRole(candidate.data("edgeRole"));

        /*
          Never use another reification edge
          as the proposition source.
        */

        if (candidateRole === "reification") {
          return false;
        }
        const candidateConditionId = String(candidate.data("conditionId") || "").trim();
        return (candidate.target().id() === endpointNode.id() && candidateConditionId === conditionId);
      });
    if (!matchingEdges || matchingEdges.length === 0) {
      return null;
    }

    /*
      Prefer an edge coming directly from the
      condition node itself.

      This makes the lookup deterministic if a
      large graph happens to contain multiple
      edges targeting the same node.
    */

    const directConditionEdges = matchingEdges.filter(candidate => candidate.source().id() === conditionId);
    const propositionEdge = directConditionEdges.length > 0 ? directConditionEdges.first() : matchingEdges.first();
    if (!propositionEdge || propositionEdge.empty()) {
      return null;
    }
    const sourceNode = propositionEdge.source();
    const sourceNodeType = normaliseNodeType(sourceNode.data("nodeType"), sourceNode.data("conditionOwnerId"));

    /*
      Normally the proposition edge starts from
      the conditional node.

      Instead of displaying:

        When temperatures fall seeks Shelter

      resolve that condition's owner:

        Lizards seeks Shelter
    */

    let subjectLabel = sourceNode.data("label") || sourceNode.id();
    if (sourceNodeType === "conditional") {
      const ownerId = String(sourceNode.data("conditionOwnerId") || "").trim();
      if (ownerId) {
        const ownerNode = cy.getElementById(ownerId);
        if (ownerNode && !ownerNode.empty()) {
          subjectLabel = ownerNode.data("label") || ownerNode.id();
        }
      }
    }
    return {
      subject: subjectLabel,
      relationship: String(propositionEdge.data("relationship") || "").trim(),
      qualifier: String(propositionEdge.data("qualifier") || "").trim(),
      adjuncts: normaliseEdgeAdjuncts(propositionEdge.data("adjuncts")),
      object: endpointNode.data("label") || endpointNode.id(),
      edgeId: propositionEdge.id(),
    };
  }

  function formatProposition(proposition) {
    if (!proposition) {
      return "";
    }
    return [
      proposition.subject,
      proposition.relationship,
      proposition.object,
    ]
      .filter(Boolean)
      .join(" ");
  }

  function syncGraphSelectionState(preferredElement = null) {
    const cy = cyRef.current;
    if (!cy) {
      return;
    }
    const selectedNodes = cy.nodes(":selected");
    const selectedEdges = cy.edges(":selected");

    /*
      Keep a React-friendly summary of the entire
      Cytoscape selection.

      selectedNode / selectedEdge remain representative
      items for toolbar controls.
    */

    setSelectionSummary({
      nodes: selectedNodes.map((node) => {
        const nodeType = normaliseNodeType(node.data("nodeType"), node.data("conditionOwnerId"));
        const ownerId = String(node.data("conditionOwnerId") || "").trim();
        let ownerLabel = "";
        if (ownerId) {
          const ownerNode = cy.getElementById(ownerId);
          if (ownerNode && !ownerNode.empty()) {
            ownerLabel = ownerNode.data("label") || ownerNode.id();
          }
        }
        return {
          id: node.id(),
          label: node.data("label") || node.id(),
          nodeType,
          conditionOwnerId: ownerId,
          conditionOwnerLabel: ownerLabel,
          hasImage: Boolean(node.data("imageSrc")),
        };
      }),
      edges: selectedEdges
        .filter(edge => !isInternalConditionOwnerEdge(edge))
        .map((edge) => {
          const sourceNode = edge.source();
          const targetNode = edge.target();
          const actualSourceLabel = sourceNode.data("label") || sourceNode.id();
          const targetLabel = targetNode.data("label") || targetNode.id();
          const conditionId = String(edge.data("conditionId") || "").trim();
          let conditionLabel = "";
          if (conditionId) {
            const conditionNode = cy.getElementById(conditionId);
            if (conditionNode && !conditionNode.empty()) {
              conditionLabel = conditionNode.data("label") || conditionNode.id();
            }
          }

          /*
            If this edge comes directly out of a
            conditional node, display the condition's
            semantic owner instead.

            Actual graph:
              When temperatures fall -> Shelter

            Selection panel:
              Lizards -> Shelter
              seeks
              Scope: When temperatures fall
          */

          const sourceNodeType = normaliseNodeType(sourceNode.data("nodeType"), sourceNode.data("conditionOwnerId"));
          const conditionOwnerId = String(sourceNode.data("conditionOwnerId") || "").trim();
          let semanticSourceLabel = actualSourceLabel;
          let conditionalSource = false;
          if (sourceNodeType === "conditional" && conditionOwnerId) {
            const ownerNode = cy.getElementById(conditionOwnerId);
            if (ownerNode && !ownerNode.empty()) {
              semanticSourceLabel = ownerNode.data("label") || ownerNode.id();
              conditionalSource = true;
            }
          }
          const resolvedClassification = edge.data("resolvedClassification") ||
            normaliseEdgeClassification(edge.data("classification"));
          const resolvedEdgeRole = edge.data("resolvedEdgeRole") || normaliseEdgeRole(edge.data("edgeRole"));

          /*
            Reification edges get additional semantic
            information reconstructed from their linked
            proposition edges.
          */

          let sourceProposition = null;
          let targetProposition = null;
          if (resolvedEdgeRole === "reification" && conditionId) {
            sourceProposition = getReificationProposition(cy, sourceNode, conditionId);
            targetProposition = getReificationProposition(cy, targetNode, conditionId);
          }
          return {
            id: edge.id(),

            /*
              sourceLabel is the human-readable semantic
              source used by the selection card.
            */

            sourceLabel: semanticSourceLabel,

            /*
              Keep the real graph endpoint too in case it
              is useful elsewhere later.
            */

            actualSourceLabel,
            targetLabel,
            conditionalSource,
            conditionOwnerId,
            relationship: String(edge.data("relationship") || "").trim(),
            qualifier: String(edge.data("qualifier") || "").trim(),
            adjuncts: normaliseEdgeAdjuncts(edge.data("adjuncts")),
            classification: resolvedClassification,
            edgeRole: resolvedEdgeRole,
            conditionId,
            conditionLabel,
            sourceProposition,
            targetProposition,
          };
        }),
    });

    /*
      For toolbar indicators, use the element most
      recently clicked when possible.

      Otherwise use the final selected element.
    */

    let representativeNode = null;
    if (preferredElement?.isNode?.() && preferredElement.selected()) {
      representativeNode = preferredElement;
    } else if (selectedNodes.length > 0) {
      representativeNode = selectedNodes[selectedNodes.length - 1];
    }
    let representativeEdge = null;
    if (preferredElement?.isEdge?.() && preferredElement.selected()) {
      representativeEdge = preferredElement;
    } else if (selectedEdges.length > 0) {
      representativeEdge = selectedEdges[selectedEdges.length - 1];
    }
    setSelectedNode(representativeNode ? buildSelectedNodeData(representativeNode) : null);
    setSelectedEdge(representativeEdge ? buildSelectedEdgeData(representativeEdge) : null);
  }

  function changeSelectedNodeColor(newColor) {
    const nodes = getSelectedCyNodes();
    if (!nodes) {
      return;
    }
    nodes.forEach(node => {
      node.data("color", newColor);
      if (normaliseNodeType(node.data("nodeType"), node.data("conditionOwnerId")) === "conditional") {
        node.data({
          conditionColor: newColor,
          conditionColorAuto: false,
        });
      }
      node.updateStyle();
    });
    syncConditionalGraphSemantics(cyRef.current);

    /*
      Keep the toolbar representative in sync.
    */

    setSelectedNode(current => current ? {
        ...current,
        color: newColor,
      } : current);
  }

  function getSingleNodeForImageEdit(nodeId = null) {
    const cy = cyRef.current;
    if (!cy) {
      return null;
    }
    if (nodeId) {
      const node = cy.getElementById(String(nodeId));
      return (node && !node.empty() ? node : null);
    }
    const selected = cy.$(":selected");
    if (selected.length !== 1 || !selected[0]?.isNode?.()) {
      return null;
    }
    return selected[0];
  }
  async function attachImageToNode(file, nodeId = null) {
    const targetNode = getSingleNodeForImageEdit(nodeId);
    if (!targetNode) {
      showGraphFeedback("Select exactly one node before attaching an image.", "error");
      return false;
    }
    const targetNodeId = targetNode.id();
    const targetNoteId = loadedGraphNoteIdRef.current;
    showGraphFeedback("Processing node image...", "info");
    try {
      const processed = await processNodeImageFile(file);
      const cy = cyRef.current;
      if (!cy || loadedGraphNoteIdRef.current !== targetNoteId) {
        return false;
      }
      const node = cy.getElementById(targetNodeId);
      if (!node || node.empty()) {
        showGraphFeedback("That node no longer exists.", "error");
        return false;
      }
      node.data({
        imageSrc: processed.dataUrl,
        imageMime: processed.mime,
        imageName: file.name || "Pasted image",
        imageWidth: processed.width,
        imageHeight: processed.height,
        imageOriginalWidth: processed.originalWidth,
        imageOriginalHeight: processed.originalHeight,
        imageStoredBytes: processed.storedBytes,
        imageFit: node.data("imageFit") || "cover",
        imageSize: node.data("imageSize") || NODE_IMAGE_DEFAULT_SIZE,
        imagePositionX: `${getImagePositionPercent(node.data("imagePositionX"), NODE_IMAGE_DEFAULT_POSITION_X)}%`,
        imagePositionY: `${getImagePositionPercent(node.data("imagePositionY"), NODE_IMAGE_DEFAULT_POSITION_Y)}%`,
        showImageLabel: node.data("showImageLabel") !== false,
      });
      resizeNodeToLabel(node);
      syncImageNodePresentation(node);
      syncImageNodeDefaultTextColours(cy);
      node.updateStyle();
      cy.style().update();
      if (node.selected()) {
        syncGraphSelectionState(node);
      }
      showGraphFeedback(`Image attached to ${node.data("label") ||
        "node"} (${formatNodeImageBytes(processed.storedBytes)})`, "success");
      return true;
    }
    catch (error) {
      console.error("Unable to attach node image:", error);
      showGraphFeedback(error?.message || "Unable to attach that image.", "error");
      return false;
    }
  }

  function openNodeImageModal() {
    const node = getSingleNodeForImageEdit();
    if (!node) {
      showGraphFeedback("Select exactly one node before editing its image.", "error");
      return;
    }
    setShapeMenuOpen(false);
    setNodeBorderStyleMenuOpen(false);
    setEdgeStyleMenuOpen(false);
    setArrowShapeMenuOpen(false);
    setGraphColorPicker(null);
    setNodeImageModalOpen(true);
  }

  function closeNodeImageModal() {
    setNodeImageModalOpen(false);
  }

  function changeSelectedNodeImageFit(imageFit) {
    const node = getSingleNodeForImageEdit();
    if (!node || !node.data("imageSrc") || !["cover", "contain"].includes(imageFit)) {
      return;
    }
    node.data("imageFit", imageFit);
    node.updateStyle();
    cyRef.current?.style().update();
    syncGraphSelectionState(node);
  }

  function changeSelectedNodeImageSize(imageSize) {
    const node = getSingleNodeForImageEdit();
    if (!node || !node.data("imageSrc") || !NODE_IMAGE_SIZE_PRESETS[imageSize]) {
      return;
    }
    node.data("imageSize", imageSize);
    resizeNodeToLabel(node);
    node.updateStyle();
    cyRef.current?.style().update();
    syncGraphSelectionState(node);
  }

  function changeSelectedNodeImagePosition(x, y) {
    const node = getSingleNodeForImageEdit();
    if (!node || !node.data("imageSrc")) {
      return;
    }
    const safeX = clampImagePosition(x);
    const safeY = clampImagePosition(y);
    node.data({
      imagePositionX: `${safeX}%`,
      imagePositionY: `${safeY}%`,
    });
    node.updateStyle();
    cyRef.current ?.style()
      .update();
    syncGraphSelectionState(node);
  }

  function resetSelectedNodeImagePosition() {
    changeSelectedNodeImagePosition(NODE_IMAGE_DEFAULT_POSITION_X, NODE_IMAGE_DEFAULT_POSITION_Y);
  }

  function changeSelectedNodeImageLabelVisibility(visible) {
    const node = getSingleNodeForImageEdit();
    if (!node || !node.data("imageSrc")) {
      return;
    }
    node.data("showImageLabel", Boolean(visible));
    syncImageNodePresentation(node);
    node.updateStyle();
    cyRef.current?.style().update();
    syncGraphSelectionState(node);
  }

  function openNodeImagePicker() {
    const node = getSingleNodeForImageEdit();
    if (!node) {
      showGraphFeedback("Select exactly one node before attaching an image.", "error");
      return;
    }
    nodeImageTargetIdRef.current = node.id();
    nodeImageInputRef.current ?.click();
  }

  function handleNodeImageFileChange(event) {
    const file = event.target.files?.[0] ?? null;
    const targetNodeId = nodeImageTargetIdRef.current;
    nodeImageTargetIdRef.current = null;

    /*
      Reset the native input so choosing the same file again still
      fires a change event after a remove/replace operation.
    */

    event.target.value = "";
    if (!file || !targetNodeId) {
      return;
    }
    void attachImageToNode(file, targetNodeId);
  }

  function removeImageFromSelectedNode() {
    const node = getSingleNodeForImageEdit();
    if (!node) {
      showGraphFeedback("Select exactly one node before removing an image.", "error");
      return;
    }
    if (!node.data("imageSrc")) {
      return;
    }
    [
      "imageSrc",
      "imageMime",
      "imageName",
      "imageWidth",
      "imageHeight",
      "imageOriginalWidth",
      "imageOriginalHeight",
      "imageStoredBytes",
      "imageFit",
      "imageSize",
      "showImageLabel",
    ].forEach(key => node.removeData(key));
    resizeNodeToLabel(node);
    syncImageNodePresentation(node);
    node.updateStyle();
    cyRef.current?.style().update();
    syncGraphSelectionState(node);
    showGraphFeedback(`Removed image from ${node.data("label") || "node"}`, "success");
  }

  function handleNodeRenameImagePaste(event) {
    const imageFile = getClipboardImageFile(event);
    if (!imageFile) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    void attachImageToNode(imageFile, editingNodeIdRef.current || editingNodeId);
  }

  function startNodeImagePreviewDrag(event) {
    if (event.button !== 0 || !selectedNode?.imageSrc || selectedNode.imageFit === "contain") {
      return;
    }
    event.preventDefault();
    const target = event.currentTarget;
    const bounds = target.getBoundingClientRect();
    const startX = getImagePositionPercent(selectedNode.imagePositionX, NODE_IMAGE_DEFAULT_POSITION_X);
    const startY = getImagePositionPercent(selectedNode.imagePositionY, NODE_IMAGE_DEFAULT_POSITION_Y);
    imagePreviewDragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX,
      startY,
      width: Math.max(1, bounds.width),
      height: Math.max(1, bounds.height),
    };
    target.setPointerCapture?.(event.pointerId);
    setImagePreviewDragging(true);
  }

  function moveNodeImagePreviewDrag(event) {
    const drag = imagePreviewDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    event.preventDefault();

    /*
      With cover, increasing background-position
      shifts the visible crop toward the opposite
      side of the oversized image.

      Subtracting the drag delta makes this behave
      like physically grabbing the photograph.
    */

    const deltaX = (event.clientX -
      drag.startClientX) /
      drag.width *
      100;
    const deltaY = (event.clientY -
      drag.startClientY) /
      drag.height *
      100;
    changeSelectedNodeImagePosition(drag.startX -
      deltaX, drag.startY -
    deltaY);
  }

  function finishNodeImagePreviewDrag(event) {
    const drag = imagePreviewDragRef.current;
    if (!drag) {
      return;
    }
    if (event.currentTarget
      .hasPointerCapture?.(event.pointerId)) {
      event.currentTarget
        .releasePointerCapture(event.pointerId);
    }
    imagePreviewDragRef.current = null;
    setImagePreviewDragging(false);
  }

  function changeSelectedNodeShape(newShape) {
    const nodes = getSelectedCyNodes();
    if (!nodes) {
      return;
    }
    nodes.forEach(node => {
      node.data("shape", newShape);
      node.updateStyle();

      /*
        Different shapes require different dimensions.
      */

      resizeNodeToLabel(node);
    });
    setSelectedNode(current => current ? {
        ...current,
        shape: newShape,
      } : current);
    setShapeMenuOpen(false);
    setNodeBorderStyleMenuOpen(false);
    setEdgeStyleMenuOpen(false);
    setArrowShapeMenuOpen(false);
    setGraphColorPicker(null);
  }

  function changeSelectedNodeBorderColor(newColor) {
    const nodes = getSelectedCyNodes();
    if (!nodes) {
      return;
    }
    nodes.forEach(node => {
      node.data("borderColor", newColor);
      if (normaliseNodeType(node.data("nodeType"), node.data("conditionOwnerId")) === "conditional") {
        node.data("conditionBorderAuto", false);
      }
      node.updateStyle();
    });
    setSelectedNode(current => current ? {
        ...current,
        borderColor: newColor,
      } : current);
  }

  function changeSelectedNodeBorderStyle(newStyle) {
    const nodes = getSelectedCyNodes();
    if (!nodes) {
      return;
    }
    nodes.forEach(node => {
      node.data("borderStyle", newStyle);
      node.updateStyle();
    });
    setSelectedNode(current => current ? {
        ...current,
        borderStyle: newStyle,
      } : current);
    setNodeBorderStyleMenuOpen(false);
  }

  function changeSelectedEdgeColor(colour) {
    const edges = getSelectedCyEdges();
    if (!edges) {
      return;
    }
    edges.forEach(edge => {
      edge.data("edgeColor", colour);
      edge.updateStyle();
    });
    setSelectedEdge(current => current ? {
        ...current,
        edgeColor: colour,
      } : current);

    /*
      Refresh derived edge semantics and annotation presentation
      after changing the edge colour.
    */

    syncConditionalGraphSemantics(cyRef.current);
  }

  function changeSelectedEdgeStyle(lineStyle) {
    const edges = getSelectedCyEdges();
    if (!edges) {
      return;
    }
    edges.forEach(edge => {
      edge.data("lineStyle", lineStyle);
      edge.updateStyle();
    });
    setSelectedEdge(current => current ? {
        ...current,
        lineStyle,
      } : current);
    setEdgeStyleMenuOpen(false);
  }

  function changeSelectedArrowColor(colour) {
    const edges = getSelectedCyEdges();
    if (!edges) {
      return;
    }
    edges.forEach(edge => {
      edge.data("arrowColor", colour);
      edge.updateStyle();
    });

    /*
      Keep the toolbar indicator synced with
      the most recently selected / representative edge.
    */

    setSelectedEdge(current => current ? {
        ...current,
        arrowColor: colour,
      } : current);
  }

  function changeSelectedArrowShape(shape) {
    const edges = getSelectedCyEdges();
    if (!edges) {
      return;
    }
    edges.forEach(edge => {
      edge.data("arrowShape", shape);
      edge.updateStyle();
    });
    setSelectedEdge(current => current ? {
        ...current,
        arrowShape: shape,
      } : current);
    setArrowShapeMenuOpen(false);
  }

  /* =========================================================
     NODE / EDGE SEMANTIC PROPERTIES
     ========================================================= */

  function getNodePropertyOptions(excludedNodeId = "") {
    const cy = cyRef.current;
    if (!cy) {
      return [];
    }
    return cy.nodes()
      .filter(node => !node.data("graphInternal") && node.id() !== excludedNodeId &&
        normaliseNodeType(node.data("nodeType"), node.data("conditionOwnerId")) !== "conditional")
      .map(node => ({
        id: node.id(),
        label: node.data("label") || node.id(),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  function getConditionalPropertyOptions() {
    return getConditionalNodes()
      .map(node => ({
        id: node.id(),
        label: node.data("label") || node.id(),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  function getSingleSelectedEdgeForProperties(edgeId = "") {
    const cy = cyRef.current;
    if (!cy) {
      return null;
    }
    if (edgeId) {
      const edge = cy.getElementById(edgeId);
      return (edge && !edge.empty() && edge.isEdge() && !isInternalConditionOwnerEdge(edge)) ? edge : null;
    }
    const selectedEdges = cy.edges(":selected")
      .filter(edge => !isInternalConditionOwnerEdge(edge));
    return selectedEdges.length === 1 ? selectedEdges[0] : null;
  }

  function closeNodePropertiesModal() {
    setNodePropertiesModalOpen(false);
    setPropertyDropdownOpen(null);
    setNodeOwnerSearch("");
  }

  function closeEdgePropertiesModal() {
    setEdgePropertiesModalOpen(false);
    setPropertyDropdownOpen(null);
    setEdgeConditionSearch("");
  }

  function openNodePropertiesModal() {
    const node = getSingleNodeForImageEdit();
    if (!node) {
      showGraphFeedback("Select exactly one node before editing node properties.", "error");
      return;
    }
    setShapeMenuOpen(false);
    setNodeBorderStyleMenuOpen(false);
    setEdgeStyleMenuOpen(false);
    setArrowShapeMenuOpen(false);
    setGraphColorPicker(null);
    setEdgePropertiesModalOpen(false);
    setPropertyDropdownOpen(null);
    setNodeOwnerSearch("");
    setNodePropertiesDraft({
      nodeId: node.id(),
      nodeType: normaliseNodeType(node.data("nodeType"), node.data("conditionOwnerId")),
      conditionOwnerId: String(node.data("conditionOwnerId") || ""),
    });
    setNodePropertiesModalOpen(true);
  }

  function saveNodeProperties() {
    const cy = cyRef.current;
    if (!cy) {
      return;
    }
    const node = cy.getElementById(nodePropertiesDraft.nodeId);
    if (!node || node.empty()) {
      closeNodePropertiesModal();
      return;
    }
    const nextNodeType = normaliseNodeType(nodePropertiesDraft.nodeType);
    const ownerId = String(nodePropertiesDraft.conditionOwnerId || "").trim();
    if (nextNodeType === "conditional" && !ownerId) {
      showGraphFeedback("Choose a parent / owner node for this conditional.", "error");
      return;
    }
    if (nextNodeType === "conditional" && ownerId === node.id()) {
      showGraphFeedback("A conditional node cannot use itself as its parent.", "error");
      return;
    }
    if (nextNodeType === "conditional") {
      const ownerNode = cy.getElementById(ownerId);
      if (!ownerNode || ownerNode.empty()) {
        showGraphFeedback("That parent node no longer exists.", "error");
        return;
      }
      const wasConditional = normaliseNodeType(node.data("nodeType"), node.data("conditionOwnerId")) === "conditional";
      const previousOwnerId = String(node.data("conditionOwnerId") || "").trim();
      if (!wasConditional || previousOwnerId !== ownerId) {
        node.data("conditionPlacement", "auto");
        node.removeData("conditionOffsetX");
        node.removeData("conditionOffsetY");
      }
      const conditionColour = wasConditional ? getConditionalNodeColour(node)
        : getNextConditionalPaletteColour(cy, node.id());
      const useAutomaticBorder = !wasConditional || node.data("conditionBorderAuto") === true ||
        !node.data("borderColor");
      node.data({
        nodeType: "conditional",
        conditionOwnerId: ownerId,
        conditionColor: conditionColour,
        conditionColorAuto: wasConditional ? Boolean(node.data("conditionColorAuto")) : true,
        color: conditionColour,
        textColor: wasConditional ? node.data("textColor") || CONDITIONAL_NODE_DEFAULT_TEXT_COLOR
          : CONDITIONAL_NODE_DEFAULT_TEXT_COLOR,
        borderColor: useAutomaticBorder ? getConditionalDefaultBorderColour() : node.data("borderColor"),
        conditionBorderAuto: useAutomaticBorder,
      });
      syncConditionalGraphSemantics(cy);
      placeConditionalNextToOwner(node);
    } else {
      const oldConditionColour = node.data("conditionColor");
      const oldConditionBorderWasAuto = node.data("conditionBorderAuto") === true;
      node.data("nodeType", "standard");
      node.removeData("conditionOwnerId");
      node.removeData("conditionColor");
      node.removeData("conditionColorAuto");
      node.removeData("conditionBorderAuto");
      node.removeData("conditionPlacement");
      node.removeData("conditionOffsetX");
      node.removeData("conditionOffsetY");
      if (oldConditionColour && node.data("color") === oldConditionColour) {
        node.data("color", getThemeColour("--graph-node-bg", "#6366F1"));
      }
      if (oldConditionBorderWasAuto || (oldConditionColour && node.data("borderColor") === oldConditionColour)) {
        node.data("borderColor", getThemeColour("--graph-node-border", "#818CF8"));
      }
      if (node.data("textColor") === CONDITIONAL_NODE_DEFAULT_TEXT_COLOR) {
        node.data("textColor", getThemeColour("--graph-node-text", "#ffffff"));
      }
      syncConditionalGraphSemantics(cy);
    }
    resizeNodeToLabel(node);
    node.updateStyle();
    syncGraphSelectionState(node);
    setNodePropertiesModalOpen(false);
    showGraphFeedback(nextNodeType === "conditional" ? "Conditional node properties saved"
      : "Node properties saved", "success");
  }

  function openEdgePropertiesModal() {
    const edge = getSingleSelectedEdgeForProperties();
    if (!edge) {
      showGraphFeedback("Select exactly one edge before editing edge properties.", "error");
      return;
    }
    syncConditionalGraphSemantics(edge.cy());
    setShapeMenuOpen(false);
    setNodeBorderStyleMenuOpen(false);
    setEdgeStyleMenuOpen(false);
    setArrowShapeMenuOpen(false);
    setGraphColorPicker(null);
    setNodePropertiesModalOpen(false);
    setPropertyDropdownOpen(null);
    setEdgeConditionSearch("");
    setEdgePropertiesDraft({
      edgeId: edge.id(),
      relationship: String(edge.data("relationship") || ""),
      qualifier: String(edge.data("qualifier") || ""),
      adjunctsText: normaliseEdgeAdjuncts(edge.data("adjuncts")).join(", "),
      classification: normaliseEdgeClassification(edge.data("classification")),
      edgeRole: normaliseEdgeRole(edge.data("edgeRole"), edge.data("isReification") === true ||
        edge.data("reification") === true),
      conditionId: String(edge.data("conditionId") || ""),
    });
    setEdgePropertiesModalOpen(true);
  }

  function saveEdgeProperties() {
    const edge = getSingleSelectedEdgeForProperties(edgePropertiesDraft.edgeId);
    if (!edge) {
      closeEdgePropertiesModal();
      return;
    }
    const nextRole = normaliseEdgeRole(edgePropertiesDraft.edgeRole);
    const nextAdjuncts = normaliseEdgeAdjuncts(edgePropertiesDraft.adjunctsText);
    edge.data({
      relationship: edgePropertiesDraft.relationship.trim(),
      qualifier: edgePropertiesDraft.qualifier.trim(),
      classification: edgePropertiesDraft.classification === "normal" ? ""
        : normaliseEdgeClassification(edgePropertiesDraft.classification),
      edgeRole: nextRole,
    });
    edge.removeData("adjunct");
    if (nextAdjuncts.length > 0) {
      edge.data("adjuncts", nextAdjuncts);
    } else {
      edge.removeData("adjuncts");
    }
    const selectedConditionId = String(edgePropertiesDraft.conditionId || "").trim();
    if (selectedConditionId && nextRole !== "standard") {
      edge.data("conditionId", selectedConditionId);
    } else {
      edge.removeData("conditionId");
    }

    /*
      Legacy backend flags are converted into edgeRole once the user edits
      the edge, preventing two sources of truth from fighting each other.
    */

    edge.removeData("isReification");
    edge.removeData("reification");
    syncConditionalGraphSemantics(edge.cy());
    syncGraphSelectionState(edge);
    setEdgePropertiesModalOpen(false);
    showGraphFeedback(edge.data("resolvedEdgeRole") === "reification" ? "Reification edge properties saved"
      : "Edge properties saved", "success");
  }

  function showGraphFeedback(message, type = "success") {
    setGraphFeedback({
      message,
      type,
    });
    if (graphFeedbackTimerRef.current) {
      clearTimeout(graphFeedbackTimerRef.current);
    }
    graphFeedbackTimerRef.current = setTimeout(() => {
        setGraphFeedback(null);
      }, 2500);
  }

  function deleteSelectedElement() {
    const cy = cyRef.current;
    if (!cy) {
      return;
    }
    const selected = cy.$(":selected");
    if (selected.empty()) {
      return;
    }
    const nodeCount = selected.nodes().length;
    const edgeCount = selected.edges().length;

    /*
      Removing selected nodes also removes their connected
      Cytoscape edges automatically.
    */

    selected.remove();
    syncConditionalGraphSemantics(cy);
    setSelectedNode(null);
    setSelectedEdge(null);
    setSelectionSummary({
      nodes: [],
      edges: [],
    });
    if (nodeCount > 0 && edgeCount > 0) {
      showGraphFeedback(`Deleted ${nodeCount} node${nodeCount === 1 ? "" : "s"} and ${edgeCount} selected link${edgeCount === 1 ? "" : "s"}`, "success");
    } else if (nodeCount > 0) {
      showGraphFeedback(`Deleted ${nodeCount} node${nodeCount === 1 ? "" : "s"}`, "success");
    } else {
      showGraphFeedback(`Deleted ${edgeCount} link${edgeCount === 1 ? "" : "s"}`, "success");
    }
  }

  function createManualNode() {
    const cy = cyRef.current;
    if (!cy)
      return;
    const nodeId = `manual-node-${Date.now()}`;
    const extent = cy.extent();
    const newNode = cy.add({
      group: "nodes",
      data: {
        id: nodeId,
        label: "New Node",
        nodeType: "standard",
        color: getThemeColour("--graph-node-bg", "#6366F1"),
        textColor: getThemeColour("--graph-node-text", "#ffffff"),
        shape: "round-rectangle",
      },
      position: {
        x: (extent.x1 + extent.x2) / 2,
        y: (extent.y1 + extent.y2) / 2,
      },
    });
    resizeNodeToLabel(newNode);
    cy.elements().unselect();
    newNode.select();
    setSelectedEdge(null);
    setSelectedNode({
      ...newNode.data(),
    });
    showGraphFeedback("New node created", "success");
  }

  function finishNodeRename({ cancel = false, } = {}) {
    if (!cyRef.current || !editingNodeId) {
      return;
    }
    const node = cyRef.current.getElementById(editingNodeId);
    if (!node || node.empty()) {
      editingNodeIdRef.current = null;
      setEditingNodeId(null);
      return;
    }
    if (!cancel) {
      const cleanLabel = renameValue.trim();
      if (cleanLabel) {
        node.data("label", cleanLabel);
        syncConditionalGraphSemantics(cyRef.current);

        /*
          Label changed, so recompute the node body.
        */

        resizeNodeToLabel(node);
        setSelectedNode((current) => {
          if (!current || current.id !== editingNodeId) {
            return current;
          }
          return {
            ...current,
            label: cleanLabel,
          };
        });
        showGraphFeedback(`Renamed node to: ${cleanLabel}`, "success");
      }
    }

    /*
      Restore Cytoscape's own label.
    */

    node.style("text-opacity", 1);
    setEditingNodeId(null);
  }

  function finishEdgeRelationship({ cancel = false, } = {}) {
    if (!cyRef.current) {
      return;
    }
    const edgeId = editingEdgeIdRef.current;
    if (!edgeId) {
      return;
    }
    const edge = cyRef.current.getElementById(edgeId);
    if (!edge || edge.empty()) {
      editingEdgeIdRef.current = null;
      setEditingEdgeId(null);
      return;
    }

    /*
      ESCAPE:
      Nothing has been written into Cytoscape yet,
      so simply restore the old painted label.
    */

    if (cancel) {
      setRelationshipValue(relationshipOriginalValueRef.current);
      edge.style("text-opacity", 1);
      editingEdgeIdRef.current = null;
      setEditingEdgeId(null);
      return;
    }
    const cleanRelationship = relationshipValue.trim();
    const oldRelationship = relationshipOriginalValueRef.current
      .trim();

    /*
      Empty value means remove the relationship.
    */

    if (cleanRelationship) {
      edge.data("relationship", cleanRelationship);
    } else {
      edge.data("relationship", "");
      cyRef.current
        .style()
        .update();
    }
    syncConditionalGraphSemantics(cyRef.current);

    /*
      Keep React's Selected Edge card in sync.
    */

    setSelectedEdge(current => {
      if (!current || current.id !== edgeId) {
        return current;
      }
      return {
        ...current,
        relationship: cleanRelationship,
      };
    });
    edge.style("text-opacity", 1);
    relationshipOriginalValueRef.current = cleanRelationship;
    editingEdgeIdRef.current = null;
    setEditingEdgeId(null);

    /*
      Avoid firing feedback if nothing actually changed.
    */

    if (cleanRelationship !== oldRelationship) {
      showGraphFeedback(cleanRelationship ? `Relationship updated: ${cleanRelationship}`
        : "Relationship removed", "success");
    }
  }

  function changeSelectedNodeTextColor(newColor) {
    const nodes = getSelectedCyNodes();
    if (!nodes) {
      return;
    }
    nodes.forEach(node => {
      node.data({
        textColor: newColor,
        textColorUserSet: true,
      });
      node.updateStyle();
    });
    setSelectedNode(current => current ? {
        ...current,
        textColor: newColor,
      } : current);
  }
  async function handleSemanticSearch() {
    const query = semanticSearchQuery.trim();
    if (!query) {
      return;
    }
    // Collapse the search UI as soon as the search is submitted.
    setSemanticSearchOpen(false);
    if (!noteId) {
      showGraphFeedback("Unable to search because no note is selected.", "error");
      return;
    }
    setSemanticSearchLoading(true);
    try {
      showGraphFeedback(`Searching graph for "${query}"...`, "info");
      const result = await semanticSearchGraph(noteId, query, getEditedGraphData({
        includeNodeImages: false,
      }) ?? graphData);
      if (!result?.match) {
        showGraphFeedback(`No matching node found for "${query}".`, "error");
        return;
      }
      const match = result.match;
      const found = focusNode(match.node_id);
      if (!found) {
        showGraphFeedback("The matching node could not be found in the current graph.", "error");
        return;
      }
      showGraphFeedback(`Closest match to "${query}": ${match.label}`, "success");
      setSemanticSearchQuery("");
    }
    catch (error) {
      console.error("Semantic graph search failed:", error);
      showGraphFeedback("Unable to search the graph. Please try again.", "error");
    }
    finally {
      setSemanticSearchLoading(false);
    }
  }
  useEffect(() => {
    if (!semanticSearchOpen) {
      return;
    }

    function handleSemanticSearchOutside(event) {
      if (semanticSearchRef.current && !semanticSearchRef.current.contains(event.target)) {
        setSemanticSearchOpen(false);
      }
    }
    document.addEventListener("pointerdown", handleSemanticSearchOutside, true);
    return () => {
      document.removeEventListener("pointerdown", handleSemanticSearchOutside, true);
    };
  }, [semanticSearchOpen]);
  useEffect(() => {

    function handlePointerDownOutside(event) {
      if (graphEditorRef.current && !graphEditorRef.current.contains(event.target)) {
        setGraphEditorActive(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDownOutside);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDownOutside);
    };
  }, []);

  /* =========================================================
     CLIPBOARD IMAGE -> SELECTED NODE
     ========================================================= */

  useEffect(() => {

    function handleGraphImagePaste(event) {
      if (!graphEditorActive) {
        return;
      }
      const imageFile = getClipboardImageFile(event);
      if (!imageFile) {
        return;
      }
      const target = event.target;

      /*
        Normal text fields keep normal paste behaviour. The inline node
        rename field has its own image-paste handler so it can target the
        node being edited directly.
      */

      if (target instanceof Element) {
        if (target.closest(".graph-inline-rename")) {
          return;
        }
        if (target.closest('input, textarea, [contenteditable="true"]')) {
          return;
        }
      }
      event.preventDefault();
      const node = getSingleNodeForImageEdit();
      if (!node) {
        showGraphFeedback("Select exactly one node before pasting an image.", "error");
        return;
      }
      event.stopPropagation();
      void attachImageToNode(imageFile, node.id());
    }
    document.addEventListener("paste", handleGraphImagePaste);
    return () => {
      document.removeEventListener("paste", handleGraphImagePaste);
    };
  }, [graphEditorActive]);

  /* =========================================================
     KEYBOARD DELETE
     Delete the currently selected graph node / edge.
     ========================================================= */

  useEffect(() => {

    function handleGraphDeleteKey(event) {

      /*
        Only respond while the Graph Editor is active.
        This prevents Delete from affecting the graph
        while the user is working in Raw Notes, Summary,
        or somewhere else on the page.
      */

      if (!graphEditorActive) {
        return;
      }

      /*
        For now we use the physical Delete key only.

        Backspace is deliberately excluded because it is
        commonly used while editing text.
      */

      if (event.key !== "Delete") {
        return;
      }

      /*
        Never delete a graph element while the user is
        typing into an input, textarea, select, or
        contentEditable element.
      */

      const target = event.target;
      const isTypingTarget = target instanceof HTMLElement && (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable);
      if (isTypingTarget) {
        return;
      }

      /*
        Also protect Cytoscape's inline editing modes.

        These checks are useful even if focus handling
        changes later.
      */

      if (editingNodeId || editingEdgeId) {
        return;
      }

      /*
        Nothing selected, nothing to delete.
      */

      if (!selectedNode && !selectedEdge) {
        return;
      }

      /*
        Stop the browser / another handler from
        interpreting this Delete press.
      */

      event.preventDefault();

      /*
        Use the SAME deletion logic as the toolbar
        trash button.
      */

      deleteSelectedElement();
    }
    document.addEventListener("keydown", handleGraphDeleteKey);
    return () => {
      document.removeEventListener("keydown", handleGraphDeleteKey);
    };
  }, [
    graphEditorActive,
    selectedNode,
    selectedEdge,
    editingNodeId,
    editingEdgeId,
  ]);
  useEffect(() => {

    function handlePopoverPointerDown(event) {
      const clickedInsideShape = shapeMenuRef.current?.contains(event.target);
      const clickedInsideNodeBorderStyle = nodeBorderStyleMenuRef.current &&
        nodeBorderStyleMenuRef.current.contains(event.target);
      const clickedInsideEdgeStyle = edgeStyleMenuRef.current?.contains(event.target);
      const clickedInsideArrowShape = arrowShapeMenuRef.current?.contains(event.target);

      /*
        Close each menu when the click occurs
        outside its own wrapper.

        Capture mode means this runs before
        Cytoscape or another control can consume
        the pointer event.
      */

      if (!clickedInsideShape) {
        setShapeMenuOpen(false);
      }
      if (!clickedInsideNodeBorderStyle) {
        setNodeBorderStyleMenuOpen(false);
      }
      if (!clickedInsideEdgeStyle) {
        setEdgeStyleMenuOpen(false);
      }
      if (!clickedInsideArrowShape) {
        setArrowShapeMenuOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key !== "Escape") {
        return;
      }
      setShapeMenuOpen(false);
      setNodeBorderStyleMenuOpen(false);
      setEdgeStyleMenuOpen(false);
      setArrowShapeMenuOpen(false);
      setNodeImageModalOpen(false);
      setNodePropertiesModalOpen(false);
      setEdgePropertiesModalOpen(false);
      setPropertyDropdownOpen(null);
      setNodeOwnerSearch("");
      setEdgeConditionSearch("");
      if (linkModeRef.current) {
        cancelLinkMode();
      }
    }
    document.addEventListener("pointerdown", handlePopoverPointerDown, true);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handlePopoverPointerDown, true);
      document.removeEventListener("keydown", handleEscape);
      if (graphFeedbackTimerRef.current) {
        clearTimeout(graphFeedbackTimerRef.current);
      }
    };
  }, []);
  useImperativeHandle(ref, () => ({
    getGraphData() {
      return getEditedGraphData();
    },
    resizeGraph() {
      const cy = cyRef.current;
      if (!cy) {
        return;
      }
      // Recalculate Cytoscape's viewport for the new panel size.
      // Do not fit() here: preserving the user's current pan/zoom
      // keeps divider dragging visually stable.
      cy.resize();
    },
    createLinkedTextNode(label, linkColor) {
      return createLinkedTextNode(label, linkColor);
    },
    focusNode(nodeId) {
      return focusNode(nodeId);
    },
    setLinkedNodeHover(nodeId, color, isHovered) {
      setLinkedNodeHover(nodeId, color, isHovered);
    },
    setLinkedNodeColor(nodeId, color) {
      setLinkedNodeColor(nodeId, color);
    },
  }));

  /* =========================================================
     CURRENT TOOLBAR ICONS
     ========================================================= */

  const currentNodeShape = selectedNode ? NODE_SHAPES.find(option => option.value === (selectedNode.shape ||
        "round-rectangle")) : null;
  const CurrentNodeShapeIcon = selectedNode ? (currentNodeShape?.Icon || Squircle) : Shapes;
  const currentNodeBorderStyle = NODE_BORDER_STYLES.find(option => option.value === (selectedNode?.borderStyle ||
      "solid")) || NODE_BORDER_STYLES.find(option => option.value === "solid");
  const CurrentNodeBorderStyleIcon = currentNodeBorderStyle?.Icon || Square;
  const imagePreviewCanDrag = Boolean(selectedNode?.imageSrc && selectedNode?.imageFit !== "contain");
  const currentArrowShape = ARROW_SHAPES.find(option => option.value === (selectedEdge?.arrowShape || "triangle")) ||
    ARROW_SHAPES.find(option => option.value === "triangle");
  const CurrentArrowShapeIcon = currentArrowShape?.Icon || Triangle;
  const nodePropertiesDisplayName = (() => {
    const cy = cyRef.current;
    if (!cy || !nodePropertiesDraft.nodeId) {
      return selectedNode?.label || "";
    }
    const node = cy.getElementById(nodePropertiesDraft.nodeId);
    return !node.empty() ? node.data("label") || node.id() : selectedNode?.label || "";
  })();
  const edgePropertiesDisplayName = (() => {
    const cy = cyRef.current;
    if (!cy || !edgePropertiesDraft.edgeId) {
      return "";
    }
    const edge = cy.getElementById(edgePropertiesDraft.edgeId);
    if (!edge || edge.empty()) {
      return "";
    }
    const sourceLabel = edge.source().data("label") || edge.source().id();
    const targetLabel = edge.target().data("label") || edge.target().id();
    return `${sourceLabel} → ${targetLabel}`;
  })();
  const edgePropertiesRoleStatus = (() => {
    const requestedRole = normaliseEdgeRole(edgePropertiesDraft.edgeRole);
    const requestedLabel = EDGE_ROLES.find(option => option.value === requestedRole)?.label || "Auto-detect";
    if (requestedRole !== "auto") {
      return requestedLabel;
    }
    const cy = cyRef.current;
    if (!cy || !edgePropertiesDraft.edgeId) {
      return requestedLabel;
    }
    const edge = cy.getElementById(edgePropertiesDraft.edgeId);
    if (!edge || edge.empty()) {
      return requestedLabel;
    }
    const resolvedRole = normaliseEdgeRole(edge.data("resolvedEdgeRole"));
    const resolvedLabel = EDGE_ROLES.find(option => option.value === resolvedRole)?.label ||
      (resolvedRole === "reification" ? "Reification" : "Standard");
    return `${requestedLabel} → ${resolvedLabel}`;
  })();
  const nodePropertyOwnerOptions = [
    {
      value: "",
      label: "Select parent node...",
    },
    ...getNodePropertyOptions(nodePropertiesDraft.nodeId).map(option => ({
      value: option.id,
      label: option.label,
    })),
  ];
  const conditionalPropertyOptions = [
    {
      value: "",
      label: "Auto / none",
    },
    ...getConditionalPropertyOptions()
      .map(option => ({
        value: option.id,
        label: option.label,
      })),
  ];
  // =========================================================
  // CURRENT GRAPH SELECTION DISPLAY
  // =========================================================
  const selectedItemCount = selectionSummary.nodes.length + selectionSummary.edges.length;
  const singleSelectedNode = selectedItemCount === 1 && selectionSummary.nodes.length === 1 ? selectionSummary.nodes[0]
    : null;
  const singleSelectedEdge = selectedItemCount === 1 && selectionSummary.edges.length === 1 ? selectionSummary.edges[0]
    : null;
  const isSemanticReification = Boolean(singleSelectedEdge) && singleSelectedEdge.edgeRole === "reification" &&
    Boolean(singleSelectedEdge.sourceProposition) && Boolean(singleSelectedEdge.targetProposition);
  const isMultiSelection = selectedItemCount > 1;

  /* =========================================================
     RENDER
     ========================================================= */

  return (<section className="graph-panel">

    {/* ================================================= */}
    {/* GRAPH HEADER                                      */}
    {/* ================================================= */}

    <div className="graph-panel-heading">

      <div className="graph-panel-heading-title">
        <h2>Graph View</h2>

        <ChartLine size={21} strokeWidth={1.8} aria-hidden="true" />
      </div>

      <div className="graph-panel-header-actions">

        <div className="graph-header-status-slot">
          {error ? (<span className="graph-header-error" title={error}>
            {error}
          </span>) : null}
        </div>

        <div className="graph-generation-actions">

          <button type="button" className="graph-generate-button primary-action" onClick={generateGraph} disabled={loading}>
            <Sparkles strokeWidth={1.8} />

            <span>
              {loading ? "Generating..." : "Generate Graph"}
            </span>
          </button>

        </div>

        <button type="button" className="panel-focus-button tooltip-align-right" onClick={(event) => {
          event.stopPropagation();
          onToggleFocus?.();
        }} aria-label={isFocused ? "Exit Graph View focus mode"
          : "Focus Graph View"} aria-pressed={isFocused} data-tooltip={isFocused ? "Restore layout"
            : "Focus Graph View"}>
          {isFocused ? (<Minimize2 size={18} strokeWidth={1.9} />) : (<Maximize2 size={18} strokeWidth={1.9} />)}
        </button>

      </div>

    </div>

    {/* ================================================= */}
    {/* GRAPH EDITOR                                      */}
    {/* Mirrors raw-notes-editor                          */}
    {/* ================================================= */}

    <div ref={graphEditorRef} className={`graph-editor ${graphEditorActive
      ? "graph-editor-active" : ""}`} onPointerDownCapture={() => {
        setGraphEditorActive(true);
      }}>

      {/* =============================================== */}
      {/* GRAPH TOOLBAR                                   */}
      {/* =============================================== */}

      <div className="graph-node-toolbar" role="toolbar" aria-label="Graph editing">
        {/* ================================================= */}
        {/* NODE TOOLS                                        */}
        {/* ================================================= */}

        {/* CREATE NODE */}

        <button type="button" className="graph-toolbar-button" onClick={createManualNode} data-tooltip="Create node" aria-label="Create node">
          <span className="graph-create-action-icon">
            <Squircle size={18} strokeWidth={1.8} />
            <Plus className="graph-create-action-plus" size={9} strokeWidth={2.5} />
          </span>
        </button>

        {/* NODE PROPERTIES */}

        <button type="button" className={`graph-toolbar-button ${nodePropertiesModalOpen
          ? "graph-toolbar-button-active"
          : ""}`} disabled={!selectedNode} onClick={openNodePropertiesModal} data-tooltip={selectedNode
            ? "Node properties"
            : "Select a node first"} aria-label="Node properties" aria-haspopup="dialog" aria-expanded={nodePropertiesModalOpen}>
          <span className="graph-create-action-icon">
            <Squircle size={18} strokeWidth={1.8} />

            <Settings className="graph-create-action-plus" size={10} strokeWidth={2.2} />
          </span>
        </button>

        {/* NODE SHAPE */}

        <div className="graph-toolbar-popover-wrapper" ref={shapeMenuRef}>

          <button type="button" className={`graph-toolbar-button graph-shape-trigger ${shapeMenuOpen
            ? "graph-toolbar-button-active" : ""}`} disabled={!selectedNode} onClick={() => {
              setShapeMenuOpen(current => !current);
              setEdgeStyleMenuOpen(false);
              setArrowShapeMenuOpen(false);
            }} data-tooltip={selectedNode ? "Node shape"
              : "Select a node first"} aria-label="Node shape" aria-haspopup="true" aria-expanded={shapeMenuOpen}>
            <CurrentNodeShapeIcon size={19} strokeWidth={1.8} style={currentNodeShape?.rotation
              ? {
                transform: `rotate(${currentNodeShape.rotation}deg)`,
              } : undefined} />

            <ChevronDown size={12} strokeWidth={1.8} />
          </button>

          {shapeMenuOpen && (<div className="
                  graph-shape-popover
                  graph-icon-grid-popover
                ">

            {NODE_SHAPES.map(({ value, label, Icon, rotation, }) => (<button key={value} type="button" className={`graph-shape-option ${(selectedNode?.shape ||
              "round-rectangle") === value ? "graph-shape-option-active"
              : ""}`} onClick={() => changeSelectedNodeShape(value)} data-tooltip={label} aria-label={label}>
              <Icon size={18} strokeWidth={1.8} style={rotation
                ? {
                  transform: `rotate(${rotation}deg)`,
                } : undefined} />
            </button>))}

          </div>)}

        </div>

        {/* NODE FILL COLOUR */}

        <div className="graph-toolbar-popover-wrapper">

          <button ref={nodeColorButtonRef} type="button" className={`graph-toolbar-button tooltip-align-left ${graphColorPicker === "node-fill"
            ? "graph-toolbar-button-active"
            : ""}`} disabled={!selectedNode} onClick={() => toggleGraphColorPicker("node-fill")} data-tooltip={selectedNode
              ? "Node colour"
              : "Select a node first"} aria-label="Node colour" aria-haspopup="dialog" aria-expanded={graphColorPicker === "node-fill"}>
            <span className="graph-toolbar-color-icon">

              <PaintBucket size={19} strokeWidth={1.8} />

              <span className="graph-toolbar-color-indicator" style={{
                backgroundColor: selectedNode?.color || getThemeColour("--graph-node-bg", "#6366F1"),
              }} />

            </span>
          </button>

          <TreeNotesColorPicker open={graphColorPicker === "node-fill"} anchorRef={nodeColorButtonRef} value={selectedNode?.color ||
            getThemeColour("--graph-node-bg", "#6366F1")} onChange={changeSelectedNodeColor} onClose={() => setGraphColorPicker(null)} />

        </div>

        {/* NODE IMAGE FILL */}

        <input ref={nodeImageInputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={handleNodeImageFileChange} />

        <button type="button" className={`graph-toolbar-button ${nodeImageModalOpen
          ? "graph-toolbar-button-active"
          : ""}`} disabled={!selectedNode} onClick={openNodeImageModal} data-tooltip={selectedNode
            ? selectedNode.imageSrc ? "Edit node image" : "Add node image"
            : "Select a node first"} aria-label={selectedNode?.imageSrc ? "Edit node image"
              : "Add node image"} aria-haspopup="dialog" aria-expanded={nodeImageModalOpen}>
          <ImageIcon size={19} strokeWidth={1.8} />
        </button>

        {/* NODE TEXT COLOUR */}

        <div className="graph-toolbar-popover-wrapper">

          <button ref={nodeTextColorButtonRef} type="button" className={`graph-toolbar-button ${graphColorPicker === "node-text"
            ? "graph-toolbar-button-active"
            : ""}`} disabled={!selectedNode} onClick={() => toggleGraphColorPicker("node-text")} data-tooltip={selectedNode
              ? "Text colour"
              : "Select a node first"} aria-label="Text colour" aria-haspopup="dialog" aria-expanded={graphColorPicker === "node-text"}>
            <span className="graph-toolbar-color-icon">

              <FontColorIcon size={19} strokeWidth={1.8} />

              <span className="graph-toolbar-color-indicator" style={{
                backgroundColor: selectedNode?.textColor || getThemeColour("--graph-node-text", "#ffffff"),
              }} />

            </span>
          </button>

          <TreeNotesColorPicker open={graphColorPicker === "node-text"} anchorRef={nodeTextColorButtonRef} value={selectedNode?.textColor ||
            getThemeColour("--graph-node-text", "#ffffff")} onChange={changeSelectedNodeTextColor} onClose={() => setGraphColorPicker(null)} />

        </div>

        {/* NODE BORDER STYLE */}

        <div className="graph-toolbar-popover-wrapper" ref={nodeBorderStyleMenuRef}>
          <button type="button" className={`graph-toolbar-button ${nodeBorderStyleMenuOpen
            ? "graph-toolbar-button-active" : ""}`} disabled={!selectedNode} onClick={() => {
              setNodeBorderStyleMenuOpen(current => !current);
              setShapeMenuOpen(false);
              setEdgeStyleMenuOpen(false);
              setArrowShapeMenuOpen(false);
            }} data-tooltip={selectedNode ? "Node border style"
              : "Select a node first"} aria-label="Node border style" aria-haspopup="true" aria-expanded={nodeBorderStyleMenuOpen}>
            <CurrentNodeBorderStyleIcon size={19} strokeWidth={1.8} />

            <ChevronDown size={11} strokeWidth={1.8} />
          </button>

          {nodeBorderStyleMenuOpen && (<div className="graph-shape-popover">

            {NODE_BORDER_STYLES.map(({ value, label, Icon, }) => (<button key={value} type="button" className={`graph-shape-option ${(selectedNode
              ?.borderStyle || "solid") === value ? "graph-shape-option-active"
              : ""}`} onClick={() => changeSelectedNodeBorderStyle(value)} data-tooltip={label} aria-label={label}>
              <Icon size={18} strokeWidth={1.8} />
            </button>))}

          </div>)}
        </div>

        {/* NODE BORDER COLOUR */}

        <div className="graph-toolbar-popover-wrapper">

          <button ref={nodeBorderColorButtonRef} type="button" className={`graph-toolbar-button ${graphColorPicker === "node-border"
            ? "graph-toolbar-button-active"
            : ""}`} disabled={!selectedNode} onClick={() => toggleGraphColorPicker("node-border")} data-tooltip={selectedNode
              ? "Node border colour"
              : "Select a node first"} aria-label="Node border colour" aria-haspopup="dialog" aria-expanded={graphColorPicker === "node-border"}>
            <span className="graph-toolbar-color-icon">

              <SquareDashed size={19} strokeWidth={1.8} />

              <span className="graph-toolbar-color-indicator" style={{
                backgroundColor: selectedNode?.borderColor || getThemeColour("--graph-node-border", "#818CF8"),
              }} />

            </span>
          </button>

          <TreeNotesColorPicker open={graphColorPicker === "node-border"} anchorRef={nodeBorderColorButtonRef} value={selectedNode?.borderColor ||
            getThemeColour("--graph-node-border", "#818CF8")} onChange={changeSelectedNodeBorderColor} onClose={() => setGraphColorPicker(null)} />

        </div>

        <span className="graph-toolbar-divider" />

        {/* ================================================= */}
        {/* EDGE / RELATIONSHIP TOOLS                         */}
        {/* ================================================= */}

        {/* LINK NODES */}

        <button type="button" className={`graph-toolbar-button ${linkMode
          ? "graph-toolbar-button-active" : ""}`} onClick={startLinkMode} data-tooltip={linkMode ? "Cancel linking"
            : "Create link"} aria-label={linkMode ? "Cancel linking" : "Create link"} aria-pressed={linkMode}>
          <span className="graph-create-action-icon">

            <MoveUpRight size={18} strokeWidth={1.8} />

            <Plus className="graph-create-action-plus" size={9} strokeWidth={2.5} />

          </span>
        </button>

        {/* EDGE PROPERTIES */}

        <button type="button" className={`graph-toolbar-button ${edgePropertiesModalOpen
          ? "graph-toolbar-button-active"
          : ""}`} disabled={!selectedEdge} onClick={openEdgePropertiesModal} data-tooltip={selectedEdge
            ? "Edge properties"
            : "Select an edge first"} aria-label="Edge properties" aria-haspopup="dialog" aria-expanded={edgePropertiesModalOpen}>
          <span className="graph-create-action-icon">
            <MoveUpRight size={18} strokeWidth={1.8} />

            <Settings className="graph-create-action-plus" size={10} strokeWidth={2.2} />
          </span>
        </button>

        {/* EDGE STYLE */}

        <div className="graph-toolbar-popover-wrapper" ref={edgeStyleMenuRef}>

          <button type="button" className={`graph-toolbar-button ${edgeStyleMenuOpen
            ? "graph-toolbar-button-active" : ""}`} disabled={!selectedEdge} onClick={() => {
              setEdgeStyleMenuOpen(current => !current);
              setShapeMenuOpen(false);
              setArrowShapeMenuOpen(false);
            }} data-tooltip={selectedEdge ? "Edge style" : "Select an edge first"} aria-label="Edge style">

            <span className={`
                  graph-edge-style-preview
                  graph-edge-style-${selectedEdge?.lineStyle || "solid"}
                `} />

            <ChevronDown size={11} strokeWidth={1.8} />

          </button>

          {edgeStyleMenuOpen && (<div className="graph-shape-popover">

            {EDGE_STYLES.map(({ value, label }) => (<button key={value} type="button" className={`graph-shape-option ${(selectedEdge?.lineStyle ||
              "solid") === value ? "graph-shape-option-active"
              : ""}`} onClick={() => changeSelectedEdgeStyle(value)} data-tooltip={label} aria-label={label}>

              <span className={`
                          graph-edge-style-preview
                          graph-edge-style-${value}
                        `} />

            </button>))}

          </div>)}

        </div>

        {/* EDGE COLOUR */}

        <div className="graph-toolbar-popover-wrapper">

          <button ref={edgeColorButtonRef} type="button" className={`graph-toolbar-button ${graphColorPicker === "edge"
            ? "graph-toolbar-button-active"
            : ""}`} disabled={!selectedEdge} onClick={() => toggleGraphColorPicker("edge")} data-tooltip={selectedEdge
              ? "Edge colour"
              : "Select an edge first"} aria-label="Edge colour" aria-haspopup="dialog" aria-expanded={graphColorPicker === "edge"}>
            <span className="graph-toolbar-color-icon">

              <Minus size={20} strokeWidth={2} />

              <span className="graph-toolbar-color-indicator" style={{
                backgroundColor: selectedEdge?.edgeColor || getThemeColour("--graph-edge", "#465873"),
              }} />

            </span>
          </button>

          <TreeNotesColorPicker open={graphColorPicker === "edge"} anchorRef={edgeColorButtonRef} value={selectedEdge?.edgeColor ||
            getThemeColour("--graph-edge", "#465873")} onChange={changeSelectedEdgeColor} onClose={() => setGraphColorPicker(null)} />

        </div>

        {/* ARROW SHAPE */}

        <div className="graph-toolbar-popover-wrapper" ref={arrowShapeMenuRef}>

          <button type="button" className={`graph-toolbar-button ${arrowShapeMenuOpen
            ? "graph-toolbar-button-active" : ""}`} disabled={!selectedEdge} onClick={() => {
              setArrowShapeMenuOpen(current => !current);
              setShapeMenuOpen(false);
              setEdgeStyleMenuOpen(false);
            }} data-tooltip={selectedEdge ? "Arrow shape" : "Select an edge first"} aria-label="Arrow shape">

            <CurrentArrowShapeIcon size={19} strokeWidth={1.8} style={currentArrowShape?.rotation
              ? {
                transform: `rotate(${currentArrowShape.rotation}deg)`,
              } : undefined} />

            <ChevronDown size={11} strokeWidth={1.8} />

          </button>

          {arrowShapeMenuOpen && (<div className="
                  graph-shape-popover
                  graph-icon-grid-popover
                ">

            {ARROW_SHAPES.map(({ value, label, Icon, rotation, }) => (<button key={value} type="button" className={`graph-shape-option ${(selectedEdge?.arrowShape ||
              "triangle") === value ? "graph-shape-option-active"
              : ""}`} onClick={() => changeSelectedArrowShape(value)} data-tooltip={label} aria-label={label}>

              <Icon size={18} strokeWidth={1.8} style={rotation
                ? {
                  transform: `rotate(${rotation}deg)`,
                } : undefined} />

            </button>))}

          </div>)}

        </div>

        {/* ARROW COLOUR */}

        <div className="graph-toolbar-popover-wrapper">

          <button ref={arrowColorButtonRef} type="button" className={`graph-toolbar-button ${graphColorPicker === "arrow"
            ? "graph-toolbar-button-active"
            : ""}`} disabled={!selectedEdge} onClick={() => toggleGraphColorPicker("arrow")} data-tooltip={selectedEdge
              ? "Arrow colour"
              : "Select an edge first"} aria-label="Arrow colour" aria-haspopup="dialog" aria-expanded={graphColorPicker === "arrow"}>
            <span className="graph-toolbar-color-icon">

              <ArrowRight size={19} strokeWidth={1.8} />

              <span className="graph-toolbar-color-indicator" style={{
                backgroundColor: selectedEdge?.arrowColor || getThemeColour("--graph-edge-arrow", "#7772ff"),
              }} />

            </span>
          </button>

          <TreeNotesColorPicker open={graphColorPicker === "arrow"} anchorRef={arrowColorButtonRef} value={selectedEdge?.arrowColor ||
            getThemeColour("--graph-edge-arrow", "#7772ff")} onChange={changeSelectedArrowColor} onClose={() => setGraphColorPicker(null)} />

        </div>

        <span className="graph-toolbar-divider" />

        {/* ================================================= */}
        {/* GENERAL TOOLS                                     */}
        {/* ================================================= */}

        {/* FIND LINKED TEXT */}

        <button type="button" className="graph-toolbar-button" disabled={!selectedNode} onClick={() => {
          if (!selectedNode) {
            return;
          }
          onNavigateLinkedText?.(selectedNode.id, selectedNode.label);
        }} data-tooltip={selectedNode ? "Find linked references"
          : "Select a node first"} aria-label="Find linked references">
          <Search size={19} strokeWidth={1.8} />
        </button>

        {/* DELETE ELEMENT */}

        <button type="button" className="graph-toolbar-button" onClick={deleteSelectedElement} disabled={!selectedNode && !selectedEdge} data-tooltip={selectedNode
          ? "Delete node" : selectedEdge ? "Delete edge"
            : "Select a node or edge first"} aria-label="Delete selected item">
          <Trash2 size={19} strokeWidth={1.8} />
        </button>

      </div>

      {/* =============================================== */}
      {/* GRAPH CANVAS                                    */}
      {/* =============================================== */}

      <div className={`graph-canvas-shell ${loading ? "graph-generating" : ""}`}>

        <div ref={graphContainerRef} className="graph-container" />

        {loading && (<div className="graph-generation-overlay">
          <div className="graph-generation-glow" />

          <div className="graph-generation-content">
            <span className="graph-generation-label">
              Generating graph
            </span>

            <span className="graph-generation-dots">
              <span />
              <span />
              <span />
            </span>
          </div>
        </div>)}

        {nodeImageModalOpen && selectedNode && (<div className="graph-image-modal-backdrop" onPointerDown={(event) => {
          if (event.target === event.currentTarget) {
            closeNodeImageModal();
          }
        }}>
          <div className="graph-image-modal" role="dialog" aria-modal="true" aria-labelledby="graph-image-modal-title" onPointerDown={(event) => event.stopPropagation()}>
            <div className="graph-image-modal-header">
              <div id="graph-image-modal-title" className="graph-image-modal-title">
                <ImageIcon size={18} strokeWidth={1.8} />
                <span>
                  Node Image · {selectedNode.label || "Selected node"}
                </span>
              </div>

              <button type="button" className="graph-image-modal-close" onClick={closeNodeImageModal} aria-label="Close node image settings">
                <X size={17} strokeWidth={1.9} />
              </button>
            </div>

            <div className="graph-image-modal-body">
              <div className="graph-image-preview-shell">
                {selectedNode.imageSrc ? (() => {
                  const previewSize = getNodeImagePreviewSize(selectedNode.imageWidth, selectedNode.imageHeight, selectedNode.shape ||
                    "round-rectangle", selectedNode.imageSize || NODE_IMAGE_DEFAULT_SIZE);
                  const positionX = getImagePositionPercent(selectedNode.imagePositionX, NODE_IMAGE_DEFAULT_POSITION_X);
                  const positionY = getImagePositionPercent(selectedNode.imagePositionY, NODE_IMAGE_DEFAULT_POSITION_Y);
                  const canDrag = selectedNode.imageFit !== "contain";
                  return (<div className="graph-image-preview-tooltip-anchor" data-tooltip={imagePreviewCanDrag
                    ? "Drag to reposition image. Double-click to centre." : "Fit mode displays the entire image."}>
                    <div className={`graph-image-preview-node ${imagePreviewCanDrag
                      ? "graph-image-preview-node-draggable" : ""} ${imagePreviewDragging
                        ? "graph-image-preview-node-dragging" : ""}`} style={{
                          width: `${previewSize.width}px`,
                          height: `${previewSize.height}px`,
                          clipPath: getNodeImagePreviewClipPath(selectedNode.shape || "round-rectangle"),
                          borderRadius: selectedNode.shape === "round-rectangle" ? "14px" : selectedNode.shape ===
                              "rectangle" ? "2px" : undefined,
                        }} onPointerDown={startNodeImagePreviewDrag} onPointerMove={moveNodeImagePreviewDrag} onPointerUp={finishNodeImagePreviewDrag} onPointerCancel={finishNodeImagePreviewDrag} onDoubleClick={resetSelectedNodeImagePosition}>
                      <img src={selectedNode.imageSrc} alt="" className="graph-image-preview" draggable={false} style={{
                        objectFit: selectedNode.imageFit === "contain" ? "contain" : "cover",
                        objectPosition: `${positionX}% ${positionY}%`,
                      }} />
                    </div>
                  </div>);
                })() : (<div className="graph-image-preview-empty">
                  <ImageIcon size={38} strokeWidth={1.35} />
                  <span>
                    No image attached to this node yet.
                  </span>
                </div>)}
              </div>

              {selectedNode.imageSrc && (<div className="graph-image-modal-meta">
                {selectedNode.imageWidth || "?"} × {selectedNode.imageHeight || "?"} px
                {selectedNode.imageStoredBytes ? ` · ${formatNodeImageBytes(selectedNode.imageStoredBytes)}` : ""}
              </div>)}

              <div className="graph-image-modal-actions">
                <button type="button" className="graph-image-modal-action primary" onClick={openNodeImagePicker}>
                  <ImagePlus size={16} strokeWidth={1.9} />
                  {selectedNode.imageSrc ? "Replace image" : "Choose image"}
                </button>

                {selectedNode.imageSrc && (<button type="button" className="graph-image-modal-action danger" onClick={removeImageFromSelectedNode}>
                  <Trash2 size={16} strokeWidth={1.9} />
                  Remove
                </button>)}
              </div>

              <div className="graph-image-modal-hint">
                You can also copy an image and press Ctrl+V while this node is selected.
              </div>

              {selectedNode.imageSrc && (<>
                <div className="graph-image-control">
                  <div className="graph-image-control-heading">
                    <span>Image fit</span>
                    <span>
                      {selectedNode.imageFit === "contain" ? "Fit" : "Fill"}
                    </span>
                  </div>

                  <div className="graph-image-segmented">
                    <button type="button" className={(selectedNode.imageFit ||
                      "cover") === "cover" ? "active" : ""} onClick={() => changeSelectedNodeImageFit("cover")}>
                      Fill
                    </button>

                    <button type="button" className={selectedNode.imageFit ===
                      "contain" ? "active" : ""} onClick={() => changeSelectedNodeImageFit("contain")}>
                      Fit
                    </button>
                  </div>
                </div>

                <div className="graph-image-control">
                  <div className="graph-image-control-heading">
                    <span>Node size</span>
                    <span>
                      {(selectedNode.imageSize || NODE_IMAGE_DEFAULT_SIZE)
                        .charAt(0)
                        .toUpperCase() +
                        (selectedNode.imageSize || NODE_IMAGE_DEFAULT_SIZE).slice(1)}
                    </span>
                  </div>

                  <div className="graph-image-segmented">
                    {[
                      "small",
                      "medium",
                      "large",
                    ].map((size) => (<button key={size} type="button" className={(selectedNode.imageSize ||
                      NODE_IMAGE_DEFAULT_SIZE) === size ? "active"
                      : ""} onClick={() => changeSelectedNodeImageSize(size)}>
                      {size.charAt(0).toUpperCase() +
                        size.slice(1)}
                    </button>))}
                  </div>
                </div>

                <label className="graph-image-toggle-row">
                  <span>Show node name</span>
                  <input type="checkbox" checked={selectedNode.showImageLabel !==
                    false} onChange={(event) => changeSelectedNodeImageLabelVisibility(event.target.checked)} />
                </label>

                {![
                  "rectangle",
                  "round-rectangle",
                ].includes(selectedNode.shape || "round-rectangle") && (<div className="graph-image-modal-hint">
                    Geometric node shapes crop the image to their silhouette. Rectangle and Rounded Rectangle preserve the most readable picture area.
                  </div>)}
              </>)}
            </div>
          </div>
        </div>)}

        {/* NODE PROPERTIES MODAL */}

        {nodePropertiesModalOpen && (<div className="graph-image-modal-backdrop" onPointerDown={(event) => {
          if (event.target === event.currentTarget) {
            closeNodePropertiesModal();
          }
        }}>
          <div className="graph-image-modal graph-property-modal" role="dialog" aria-modal="true" aria-labelledby="graph-node-properties-title" onPointerDown={(event) => event.stopPropagation()}>
            <div className="graph-image-modal-header">
              <div id="graph-node-properties-title" className="graph-image-modal-title">
                <span className="graph-property-modal-title-icon graph-create-action-icon">
                  <Squircle size={18} strokeWidth={1.8} />

                  <Settings className="graph-create-action-plus" size={10} strokeWidth={2.2} />
                </span>

                <span className="graph-property-modal-title-text">
                  Node Properties
                  {nodePropertiesDisplayName ? ` · ${nodePropertiesDisplayName}` : ""}
                </span>
              </div>

              <button type="button" className="graph-image-modal-close" onClick={closeNodePropertiesModal} aria-label="Close node properties">
                <X size={17} strokeWidth={1.9} />
              </button>
            </div>

            <div className="graph-image-modal-body graph-property-modal-body">
              <GraphSegmentedControl label="Node type" value={nodePropertiesDraft.nodeType} options={NODE_TYPES} statusText={NODE_TYPES.find(option => option.value ===
                nodePropertiesDraft.nodeType)?.label || "Standard"} onChange={(nextValue) => setNodePropertiesDraft(current => ({
                  ...current,
                  nodeType: nextValue,
                  conditionOwnerId: nextValue === "conditional" ? current.conditionOwnerId : "",
                }))} ariaLabel="Node type" />

              {nodePropertiesDraft.nodeType ===
                "conditional" && (<div className="graph-image-control graph-property-dropdown-control">
                  <div className="graph-image-control-heading">
                    <span>
                      Parent / owner node
                    </span>
                  </div>

                  <GraphPropertyDropdown value={nodePropertiesDraft.conditionOwnerId} options={nodePropertyOwnerOptions} placeholder="Select parent node..." isOpen={propertyDropdownOpen ===
                    "nodeOwner"} onToggle={() => {
                      setNodeOwnerSearch("");
                      setPropertyDropdownOpen(current => current === "nodeOwner" ? null : "nodeOwner");
                    }} onSelect={(nextValue) => {
                      setNodePropertiesDraft(current => ({
                        ...current,
                        conditionOwnerId: nextValue,
                      }));
                      setPropertyDropdownOpen(null);
                      setNodeOwnerSearch("");
                    }} searchable searchValue={nodeOwnerSearch} onSearchChange={setNodeOwnerSearch} searchPlaceholder="Search graph nodes..." emptyMessage="No matching graph nodes" ariaLabel="Parent or owner node" />
                </div>)}

              <div className="graph-image-modal-hint">
                Conditional nodes stay associated with their parent for layout. Links from the conditional define the propositions in that condition&apos;s scope.
              </div>

              <div className="graph-image-modal-actions">
                <button type="button" className="graph-image-modal-action" onClick={closeNodePropertiesModal}>
                  Cancel
                </button>

                <button type="button" className="graph-image-modal-action primary" onClick={saveNodeProperties}>
                  <Check size={16} strokeWidth={1.9} />
                  Save properties
                </button>
              </div>
            </div>
          </div>
        </div>)}

        {/* EDGE PROPERTIES MODAL */}

        {edgePropertiesModalOpen && (<div className="graph-image-modal-backdrop" onPointerDown={(event) => {
          if (event.target === event.currentTarget) {
            closeEdgePropertiesModal();
          }
        }}>
          <div className="graph-image-modal graph-property-modal" role="dialog" aria-modal="true" aria-labelledby="graph-edge-properties-title" onPointerDown={(event) => event.stopPropagation()}>
            <div className="graph-image-modal-header">
              <div id="graph-edge-properties-title" className="graph-image-modal-title">
                <span className="graph-property-modal-title-icon graph-create-action-icon">
                  <MoveUpRight size={18} strokeWidth={1.8} />

                  <Settings className="graph-create-action-plus" size={10} strokeWidth={2.2} />
                </span>

                <span className="graph-property-modal-title-text">
                  Edge Properties
                  {edgePropertiesDisplayName ? ` · ${edgePropertiesDisplayName}` : ""}
                </span>
              </div>

              <button type="button" className="graph-image-modal-close" onClick={closeEdgePropertiesModal} aria-label="Close edge properties">
                <X size={17} strokeWidth={1.9} />
              </button>
            </div>

            <div className="graph-image-modal-body graph-property-modal-body">
              {[
                {
                  key: "relationship",
                  label: "Relationship",
                  placeholder: "e.g. causes, contains, supports...",
                },
                {
                  key: "qualifier",
                  label: "Qualifier",
                  placeholder: "e.g. quickly, gradually, partially...",
                },
                {
                  key: "adjunctsText",
                  label: "Adjuncts",
                  status: "Comma-separated",
                  placeholder: "e.g. with tools, in water, at night...",
                },
              ].map(field => (<label key={field.key} className="graph-image-control graph-property-text-control">
                <div className="graph-image-control-heading">
                  <span>{field.label}</span>
                  {field.status && (<span>{field.status}</span>)}
                </div>

                <input type="text" className="graph-property-input" value={edgePropertiesDraft[field.key]} placeholder={field.placeholder} onChange={(event) => setEdgePropertiesDraft(current => ({
                  ...current,
                  [field.key]: event.target.value,
                }))} />
              </label>))}

              <GraphSegmentedControl label="Classification" value={normaliseEdgeClassification(edgePropertiesDraft.classification)} options={[
                {
                  value: "normal",
                  label: "Normal",
                },
                {
                  value: "negative",
                  label: "Negative",
                },
                {
                  value: "affirmative",
                  label: "Affirmative",
                },
              ]} statusText={{
                normal: "Normal",
                negative: "Negative",
                affirmative: "Affirmative",
              }[normaliseEdgeClassification(edgePropertiesDraft.classification)]} onChange={(nextValue) => setEdgePropertiesDraft(current => ({
                ...current,
                classification: nextValue,
              }))} ariaLabel="Edge classification" />

              <GraphSegmentedControl label="Edge role" value={edgePropertiesDraft.edgeRole} options={EDGE_ROLES} statusText={edgePropertiesRoleStatus} onChange={(nextValue) => setEdgePropertiesDraft(current => ({
                ...current,
                edgeRole: nextValue,
              }))} ariaLabel="Edge role" />

              {edgePropertiesDraft.edgeRole !==
                "standard" && (<div className="graph-image-control graph-property-dropdown-control">
                  <div className="graph-image-control-heading">
                    <span>
                      Conditional scope
                    </span>
                  </div>

                  <GraphPropertyDropdown value={edgePropertiesDraft.conditionId} options={conditionalPropertyOptions} placeholder="Auto / none" isOpen={propertyDropdownOpen ===
                    "edgeCondition"} onToggle={() => {
                      setEdgeConditionSearch("");
                      setPropertyDropdownOpen(current => current === "edgeCondition" ? null : "edgeCondition");
                    }} onSelect={(nextValue) => {
                      setEdgePropertiesDraft(current => ({
                        ...current,
                        conditionId: nextValue,
                      }));
                      setPropertyDropdownOpen(null);
                      setEdgeConditionSearch("");
                    }} searchable searchValue={edgeConditionSearch} onSearchChange={setEdgeConditionSearch} searchPlaceholder="Search conditions..." emptyMessage="No matching conditions" ariaLabel="Conditional scope" />
                </div>)}

              <div className="graph-image-modal-hint">
                Qualifiers modify how the relationship occurs. Adjuncts add optional context and are stored as a list. Auto-detect resolves this edge to <strong>{edgePropertiesRoleStatus.replace("Auto-detect → ", "")}</strong> using the current graph semantics.
              </div>

              <div className="graph-image-modal-actions">
                <button type="button" className="graph-image-modal-action" onClick={closeEdgePropertiesModal}>
                  Cancel
                </button>

                <button type="button" className="graph-image-modal-action primary" onClick={saveEdgeProperties}>
                  <Check size={16} strokeWidth={1.9} />
                  Save properties
                </button>
              </div>
            </div>
          </div>
        </div>)}

        {editingNodeId && (<input className="graph-inline-rename" type="text" value={renameValue} autoFocus style={{
          left: `${renamePosition.x}px`,
          top: `${renamePosition.y}px`,
          width: `${(selectedNode?.imageSrc ? Math.max(selectedNode?.nodeTextMaxWidth || 150, selectedNode?.nodeWidth ||
            110) : (selectedNode?.nodeWidth || 110)) * renameZoom}px`,
          height: `${(selectedNode?.imageSrc ? 36 : (selectedNode?.nodeHeight || 52)) * renameZoom}px`,
          fontSize: `${15 * renameZoom}px`,
          lineHeight: `${(selectedNode?.imageSrc ? 34 : 52) * renameZoom}px`,
          color: selectedNode?.textColor || getThemeColour("--graph-node-text", "#ffffff"),
        }} onChange={(event) => setRenameValue(event.target.value)} onPaste={handleNodeRenameImagePaste} onBlur={() => finishNodeRename()} onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            finishNodeRename();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            finishNodeRename({
              cancel: true,
            });
          }
        }} />)}

        {editingEdgeId && (<input className="graph-inline-edge-relationship" type="text" value={relationshipValue} autoFocus spellCheck={false} placeholder="Relationship" style={{
          left: `${relationshipPosition.x}px`,
          top: `${relationshipPosition.y}px`,
          width: `${Math.max(90, Math.min(220, relationshipValue.length * 7 +
            36)) *
            relationshipZoom}px`,
          height: `${28 *
            relationshipZoom}px`,
          fontSize: `${12 *
            relationshipZoom}px`,
          lineHeight: `${26 *
            relationshipZoom}px`,
        }} onChange={event => setRelationshipValue(event.target.value)} onBlur={() => finishEdgeRelationship()} onKeyDown={event => {
          if (event.key === "Enter") {
            event.preventDefault();
            finishEdgeRelationship();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            finishEdgeRelationship({
              cancel: true,
            });
          }
        }} />)}

        {/* TOP GRAPH OVERLAYS */}

        {(selectionSummary.nodes.length > 0 || selectionSummary.edges.length > 0 ||
          linkMode) && (<div className="graph-top-overlay-stack">

            {/* CURRENT GRAPH SELECTION */}

            {selectedItemCount > 0 && (<div className="graph-selection-overlay">

              {isMultiSelection ? (<>
                <span className="graph-selection-kicker">
                  {selectionSummary.nodes.length > 0 && selectionSummary.edges.length > 0 ? "Selected items"
                    : selectionSummary.nodes.length > 0 ? "Selected nodes" : "Selected edges"}
                </span>

                <strong className="graph-selection-title">
                  {selectionSummary.nodes.length > 0 && (<>
                    {selectionSummary.nodes.length}{" "}
                    node{selectionSummary.nodes.length === 1 ? "" : "s"}
                  </>)}

                  {selectionSummary.nodes.length > 0 && selectionSummary.edges.length > 0 && " · "}

                  {selectionSummary.edges.length > 0 && (<>
                    {selectionSummary.edges.length}{" "}
                    edge{selectionSummary.edges.length === 1 ? "" : "s"}
                  </>)}
                </strong>
              </>) : singleSelectedNode ? (<>
                <span className="graph-selection-kicker">
                  {singleSelectedNode.nodeType === "conditional" ? "Selected conditional node" : "Selected node"}
                </span>

                <strong className="graph-selection-title">
                  {singleSelectedNode.label}
                </strong>

                {singleSelectedNode.nodeType === "conditional" &&
                  singleSelectedNode.conditionOwnerLabel && (<div className="graph-selection-meta">
                    <span>Parent:</span>

                    <strong>
                      {singleSelectedNode.conditionOwnerLabel}
                    </strong>
                  </div>)}

                {singleSelectedNode.nodeType !== "conditional" &&
                  singleSelectedNode.hasImage && (<div className="graph-selection-secondary">
                    Image node
                  </div>)}
              </>) : singleSelectedEdge ? (<>
                <span className="graph-selection-kicker">
                  Selected edge
                </span>

                {isSemanticReification ? (<>
                  <div className="graph-selection-proposition" title={formatProposition(singleSelectedEdge.sourceProposition)}>
                    {formatProposition(singleSelectedEdge.sourceProposition)}
                  </div>

                  {singleSelectedEdge.relationship && (<div className="graph-selection-reification-link">
                    {singleSelectedEdge.relationship}
                  </div>)}

                  <div className="graph-selection-proposition" title={formatProposition(singleSelectedEdge.targetProposition)}>
                    {formatProposition(singleSelectedEdge.targetProposition)}
                  </div>

                  {singleSelectedEdge.adjuncts?.length > 0 && (<div className="graph-selection-adjuncts">
                    <span>Adjuncts:</span>
                    <strong>{singleSelectedEdge.adjuncts.join(" · ")}</strong>
                  </div>)}

                  {singleSelectedEdge.conditionLabel && (<div className="graph-selection-meta">
                    <span>Scope:</span>

                    <strong>
                      {singleSelectedEdge.conditionLabel}
                    </strong>
                  </div>)}
                </>) : (<>
                  <strong className="graph-selection-title">
                    {singleSelectedEdge.sourceLabel}
                    {" → "}
                    {singleSelectedEdge.targetLabel}
                  </strong>

                  {singleSelectedEdge.relationship && (<div className="graph-selection-relationship">
                    {singleSelectedEdge.relationship}
                  </div>)}

                  {singleSelectedEdge.qualifier && (<div className="graph-selection-qualifier">
                    {singleSelectedEdge.qualifier}
                  </div>)}

                  {singleSelectedEdge.adjuncts?.length > 0 && (<div className="graph-selection-adjuncts">
                    <span>Adjuncts:</span>
                    <strong>{singleSelectedEdge.adjuncts.join(" · ")}</strong>
                  </div>)}

                  {singleSelectedEdge.conditionLabel && (<div className="graph-selection-meta">
                    <span>Scope:</span>

                    <strong>
                      {singleSelectedEdge.conditionLabel}
                    </strong>
                  </div>)}
                </>)}

                {(singleSelectedEdge.classification === "negative" || singleSelectedEdge.classification ===
                  "affirmative" || singleSelectedEdge.edgeRole ===
                  "reification") && (<div className="graph-selection-badges">

                    {singleSelectedEdge.classification === "negative" && (<span className="graph-selection-badge graph-selection-badge-negative">
                        Negative
                      </span>)}

                    {singleSelectedEdge.classification === "affirmative" && (<span className="graph-selection-badge graph-selection-badge-affirmative">
                        Affirmative
                      </span>)}

                    {singleSelectedEdge.edgeRole === "reification" && (<span className="graph-selection-badge">
                        Reification
                      </span>)}

                  </div>)}
              </>) : null}

            </div>)}

            {/* LINK MODE */}

            {linkMode && (<div className="graph-link-mode-overlay">

              <Link2 size={16} strokeWidth={1.8} />

              <div>

                {!firstNodeToLink ? (<>
                  <strong>
                    Link nodes
                  </strong>

                  <span>
                    Select the first node
                  </span>
                </>) : (<>
                  <strong>
                    First node:{" "}
                    {cyRef.current ?.getElementById(firstNodeToLink)
                      .data("label")}
                  </strong>

                  <span>
                    Select the second node
                  </span>
                </>)}

              </div>

              <button type="button" onClick={cancelLinkMode} aria-label="Cancel linking">
                <X size={15} strokeWidth={1.8} />
              </button>

            </div>)}

          </div>)}

        {/* GRAPH FEEDBACK */}

        {graphFeedback && (<div className={`graph-feedback graph-feedback-${graphFeedback.type}`}>
          {graphFeedback.type === "error" ? (<CircleAlert size={16} strokeWidth={2} />) : graphFeedback.type === "info" ? (<LoaderCircle size={16} strokeWidth={2} className="graph-feedback-spinner" />) : (<Check size={16} strokeWidth={2} />)}

          <span>
            {graphFeedback.message}
          </span>
        </div>)}

        {/* SEMANTIC GRAPH SEARCH */}

        <div ref={semanticSearchRef} className={`graph-semantic-search ${semanticSearchOpen
          ? "graph-semantic-search-open" : ""}`}>

          {semanticSearchOpen ? (<>
            <Search size={17} strokeWidth={1.8} className="graph-semantic-search-icon" />

            <input type="text" value={semanticSearchQuery} onChange={(event) => setSemanticSearchQuery(event.target.value)} placeholder="Search graph..." autoFocus onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleSemanticSearch();
              }
              if (event.key === "Escape") {
                setSemanticSearchOpen(false);
              }
            }} />

            <button type="button" className="graph-semantic-submit" aria-label="Search graph" data-tooltip="Semantic search" disabled={semanticSearchLoading ||
              !semanticSearchQuery.trim()} onClick={handleSemanticSearch}>

              <ArrowUp size={17} strokeWidth={2} />

            </button>
          </>) : (<button type="button" className="graph-semantic-search-toggle" aria-label="Semantic graph search" data-tooltip="Semantic search" onClick={() => setSemanticSearchOpen(true)}>

            <Search size={18} strokeWidth={1.9} />

          </button>)}

        </div>

      </div>

    </div>

  </section>);
});
export default GraphPanel;