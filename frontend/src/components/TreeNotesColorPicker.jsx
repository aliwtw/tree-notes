import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Ban, Plus } from "lucide-react";
import "./TreeNotesColorPicker.css";

/* =========================================================
 CONSTANTS
 ========================================================= */

const CUSTOM_COLORS_KEY = "treenotes-custom-colors";
const CUSTOM_COLORS_EVENT = "treenotes-custom-colors-change";
const PRESET_COLORS = [

  // Neutral
  "#FFFFFF",
  "#E5E7EB",
  "#CBD5E1",
  "#94A3B8",
  "#64748B",
  "#475569",
  "#1E293B",
  "#000000",

  // Vivid
  "#EF4444",
  "#F97316",
  "#F59E0B",
  "#22C55E",
  "#14B8A6",
  "#0EA5E9",
  "#6366F1",
  "#EC4899",

  // Soft
  "#FCA5A5",
  "#FDBA74",
  "#FDE68A",
  "#BEF264",
  "#86EFAC",
  "#5EEAD4",
  "#7DD3FC",
  "#C4B5FD",
];

/* =========================================================
 GENERAL HELPERS
 ========================================================= */

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeHex(value) {
  if (!value) {
    return null;
  }
  let hex = String(value)
    .trim()
    .replace("#", "");
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    hex =
      hex
        .split("")
        .map((character) => character + character)
        .join("");
  }
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    return null;
  }
  return "#" + hex.toUpperCase();
}

/* =========================================================
 HEX / RGB
 ========================================================= */

function hexToRgb(hex) {
  const normalized = normalizeHex(hex);
  if (!normalized) {
    return {
      r: 98,
      g: 93,
      b: 240
    };
  }
  const value = normalized.slice(1);
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16)
  };
}

function rgbToHex({ r, g, b }) {
  const toHex = (value) => clamp(Math.round(value), 0, 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
  return "#" + toHex(r) + toHex(g) + toHex(b);
}

/* =========================================================
 RGB / HSL
 ========================================================= */

function rgbToHsl({ r, g, b }) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max +
    min) / 2;
  const difference = max - min;
  if (difference !== 0) {
    s =
      difference /
      (1 -
        Math.abs(2 * l - 1));
    switch (max) {
      case r:
        h =
          60 *
          (((g -
            b) /
            difference) %
            6);
        break;
      case g:
        h =
          60 *
          ((b -
            r) /
            difference +
            2);
        break;
      default:
        h =
          60 *
          ((r -
            g) /
            difference +
            4);
        break;
    }
  }
  if (h < 0) {
    h += 360;
  }
  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

function hslToRgb({ h, s, l }) {
  h =
    ((h %
      360) +
      360) %
    360;
  s =
    clamp(s, 0, 100) / 100;
  l =
    clamp(l, 0, 100) / 100;
  const c = (1 -
    Math.abs(2 * l - 1)) *
    s;
  const x = c *
    (1 -
      Math.abs((h / 60) %
        2 -
        1));
  const m = l -
    c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    r = c;
    g = x;
  }
  else if (h < 120) {
    r = x;
    g = c;
  }
  else if (h < 180) {
    g = c;
    b = x;
  }
  else if (h < 240) {
    g = x;
    b = c;
  }
  else if (h < 300) {
    r = x;
    b = c;
  }
  else {
    r = c;
    b = x;
  }
  return {
    r: Math.round((r +
      m) *
      255),
    g: Math.round((g +
      m) *
      255),
    b: Math.round((b +
      m) *
      255)
  };
}

/* =========================================================
 RGB / HSV
 ========================================================= */

function rgbToHsv({ r, g, b }) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const difference = max - min;
  let h = 0;
  if (difference !== 0) {
    if (max === r) {
      h =
        60 *
        (((g -
          b) /
          difference) %
          6);
    }
    else if (max === g) {
      h =
        60 *
        ((b -
          r) /
          difference +
          2);
    }
    else {
      h =
        60 *
        ((r -
          g) /
          difference +
          4);
    }
  }
  if (h < 0) {
    h += 360;
  }
  const s = max === 0
    ? 0
    : difference / max;
  return {
    h,
    s: s * 100,
    v: max * 100
  };
}

function hsvToRgb({ h, s, v }) {
  h =
    ((h %
      360) +
      360) %
    360;
  s =
    clamp(s, 0, 100) / 100;
  v =
    clamp(v, 0, 100) / 100;
  const c = v * s;
  const x = c *
    (1 -
      Math.abs((h / 60) %
        2 -
        1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    r = c;
    g = x;
  }
  else if (h < 120) {
    r = x;
    g = c;
  }
  else if (h < 180) {
    g = c;
    b = x;
  }
  else if (h < 240) {
    g = x;
    b = c;
  }
  else if (h < 300) {
    r = x;
    b = c;
  }
  else {
    r = c;
    b = x;
  }
  return {
    r: Math.round((r +
      m) *
      255),
    g: Math.round((g +
      m) *
      255),
    b: Math.round((b +
      m) *
      255)
  };
}

/* =========================================================
 CUSTOM COLOUR STORAGE
 ========================================================= */

function loadCustomColors() {
  if (typeof window ===
    "undefined") {
    return [];
  }
  try {
    const stored = JSON.parse(localStorage.getItem(CUSTOM_COLORS_KEY) ||
      "[]");
    if (!Array.isArray(stored)) {
      return [];
    }
    return stored
      .map(normalizeHex)
      .filter(Boolean);
  }
  catch {
    return [];
  }
}

function storeCustomColors(colors) {
  localStorage.setItem(CUSTOM_COLORS_KEY, JSON.stringify(colors));
  window.dispatchEvent(new CustomEvent(CUSTOM_COLORS_EVENT));
}

/* =========================================================
 CONTRAST HELPER
 ========================================================= */

function getContrastColor(hex) {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.299 * r +
    0.587 * g +
    0.114 * b) /
    255;
  return (luminance >
    0.58
    ? "#182033"
    : "#FFFFFF");
}

/* =========================================================
 COMPONENT
 ========================================================= */

export default function TreeNotesColorPicker({ open, anchorRef, value = "#625DF0", onChange, onClose, maxSavedColors = 12, showNone = false, noneDisabled = false, noneSelected = false, onNone, placement = "bottom-start" }) {

  const panelRef = useRef(null);
  const normalizedValue = normalizeHex(value) ||
    "#625DF0";
  const [mode, setMode] = useState("HEX");
  const [hsv, setHsv] = useState(() => rgbToHsv(hexToRgb(normalizedValue)));
  const [hexDraft, setHexDraft] = useState(normalizedValue);
  const [savedColors, setSavedColors] = useState(loadCustomColors);
  const [position, setPosition] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const currentRgb = useMemo(() => hsvToRgb(hsv), [hsv]);
  const currentHex = useMemo(() => rgbToHex(currentRgb), [currentRgb]);
  const currentHsl = useMemo(() => rgbToHsl(currentRgb), [currentRgb]);

  /* =======================================================
   EXTERNAL VALUE SYNCHRONISATION
   ======================================================= */

  useEffect(() => {
    const normalized = normalizeHex(value);
    if (!normalized) {
      return;
    }
    setHexDraft(normalized);
    setHsv(rgbToHsv(hexToRgb(normalized)));
  }, [value]);

  /* =======================================================
   CUSTOM COLOUR SYNCHRONISATION
   ======================================================= */

  useEffect(() => {
    function refresh() {
      setSavedColors(loadCustomColors());
    }
    window.addEventListener("storage", refresh);
    window.addEventListener(CUSTOM_COLORS_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(CUSTOM_COLORS_EVENT, refresh);
    };
  }, []);

  /* =======================================================
   POPOVER POSITIONING
   ======================================================= */

  useLayoutEffect(() => {
  if (!open) {
    setPosition(null);
    return;
  }

  let frame;

  function calculatePosition() {
    const anchor = anchorRef?.current;
    const panel = panelRef.current;

    if (!panel) return;

    const panelWidth = panel.offsetWidth;
    const panelHeight = panel.offsetHeight;
    const margin = 10;
    const gap = 8;

    let left = (window.innerWidth - panelWidth) / 2;
    let top = 80;

    if (anchor) {
      const rect = anchor.getBoundingClientRect();

      if (placement === "right-start") {
        left = rect.right + gap;
        top = rect.top;

        if (left + panelWidth > window.innerWidth - margin) {
          left = rect.left - panelWidth - gap;
        }

        if (top + panelHeight > window.innerHeight - margin) {
          top = window.innerHeight - panelHeight - margin;
        }
      }
      else {
        left = rect.left;
        top = rect.bottom + gap;

        if (top + panelHeight > window.innerHeight - margin) {
          top = rect.top - panelHeight - gap;
        }
      }
    }

    left = clamp(
      left,
      margin,
      window.innerWidth - panelWidth - margin
    );

    top = clamp(
      top,
      margin,
      window.innerHeight - panelHeight - margin
    );

    setPosition({ top, left });
  }

  function schedulePositionUpdate() {
    if (frame) {
      cancelAnimationFrame(frame);
    }

    frame = requestAnimationFrame(calculatePosition);
  }

  // Important: do the first measurement synchronously.
  // useLayoutEffect runs before the browser paints.
  calculatePosition();

  const resizeObserver =
    new ResizeObserver(schedulePositionUpdate);

  if (panelRef.current) {
    resizeObserver.observe(panelRef.current);
  }

  window.addEventListener(
    "resize",
    schedulePositionUpdate
  );

  window.addEventListener(
    "scroll",
    schedulePositionUpdate,
    true
  );

  return () => {
    if (frame) {
      cancelAnimationFrame(frame);
    }

    resizeObserver.disconnect();

    window.removeEventListener(
      "resize",
      schedulePositionUpdate
    );

    window.removeEventListener(
      "scroll",
      schedulePositionUpdate,
      true
    );
  };
}, [open, anchorRef, placement]);

  /* =======================================================
   CLICK-OUTSIDE / ESCAPE
   ======================================================= */

  useEffect(() => {
    if (!open) {
      return;
    }
    function handlePointerDown(event) {
      if (panelRef.current
        ?.contains(event.target)) {
        return;
      }
      if (anchorRef?.current
        ?.contains(event.target)) {
        return;
      }
      onClose?.();
    }
    function handleKeyDown(event) {
      if (event.key ===
        "Escape") {
        onClose?.();
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    open,
    onClose,
    anchorRef]);

  /* =======================================================
   COLOUR CHANGES
   ======================================================= */

  function commitHsv(nextHsv) {
    const normalized = {
      h: clamp(Number(nextHsv.h), 0, 360),
      s: clamp(Number(nextHsv.s), 0, 100),
      v: clamp(Number(nextHsv.v), 0, 100)
    };
    setHsv(normalized);
    const hex = rgbToHex(hsvToRgb(normalized));
    setHexDraft(hex);
    onChange?.(hex);
  }

  function commitHex(hex) {
    const normalized = normalizeHex(hex);
    if (!normalized) {
      return;
    }
    setHexDraft(normalized);
    setHsv(rgbToHsv(hexToRgb(normalized)));
    onChange?.(normalized);
  }

  function commitRgb(rgb) {
    const normalized = {
      r: clamp(Number(rgb.r), 0, 255),
      g: clamp(Number(rgb.g), 0, 255),
      b: clamp(Number(rgb.b), 0, 255)
    };
    commitHsv(rgbToHsv(normalized));
  }

  function commitHsl(hsl) {
    const normalized = {
      h: clamp(Number(hsl.h), 0, 360),
      s: clamp(Number(hsl.s), 0, 100),
      l: clamp(Number(hsl.l), 0, 100)
    };
    commitRgb(hslToRgb(normalized));
  }

  /* =======================================================
   SATURATION / BRIGHTNESS AREA
   ======================================================= */

  function updateSaturationValue(event) {
    const rect = event.currentTarget
      .getBoundingClientRect();
    const saturation = clamp((event.clientX -
      rect.left) /
      rect.width, 0, 1) *
      100;
    const brightness = (1 -
      clamp((event.clientY -
        rect.top) /
        rect.height, 0, 1)) *
      100;
    commitHsv({
      ...hsv,
      s: saturation,
      v: brightness
    });
  }

  function handleSvPointerDown(event) {
    event.preventDefault();
    event.currentTarget
      .setPointerCapture(event.pointerId);
    updateSaturationValue(event);
  }

  function handleSvPointerMove(event) {
    if (!event.currentTarget
      .hasPointerCapture(event.pointerId)) {
      return;
    }
    updateSaturationValue(event);
  }

  function handleSvPointerUp(event) {
    if (event.currentTarget
      .hasPointerCapture(event.pointerId)) {
      event.currentTarget
        .releasePointerCapture(event.pointerId);
    }
  }

  /* =======================================================
   TOOLTIP HELPERS
   ======================================================= */

  function showTooltip(event, text) {
    const rect = event.currentTarget.getBoundingClientRect();
    const halfWidth = 110;
    const centre = rect.left + (rect.width / 2);
    const below = rect.top < 60;

    setTooltip({
      text,
      left: clamp(centre, halfWidth, window.innerWidth - halfWidth),
      top: below ? rect.bottom + 8 : rect.top - 8,
      below
    });
  }

  function hideTooltip() {
    setTooltip(null);
  }

  /* =======================================================
   SAVED CUSTOM COLOURS
   ======================================================= */

  function saveCurrentColor() {
    const normalized = currentHex
      .toUpperCase();
    let next = savedColors.filter((color) => color.toUpperCase() !==
      normalized);
    next = [
      normalized,
      ...next].slice(0, maxSavedColors);
    setSavedColors(next);
    storeCustomColors(next);
  }

  function removeSavedColor(color) {
    const next = savedColors.filter((saved) => saved !==
      color);
    setSavedColors(next);
    storeCustomColors(next);
  }

  /* =======================================================
   RENDER
   ======================================================= */

  if (!open ||
    typeof document ===
    "undefined") {
    return null;
  }
  return createPortal(<>
    <div ref={panelRef} className="treenotes-color-picker" style={{
    top: position?.top ?? 0,
    left: position?.left ?? 0,
    visibility: position ? "visible" : "hidden",
    pointerEvents: position ? "auto" : "none"
  }} role="dialog" aria-label="Colour picker">

    {/* ===================================================
      PRESET COLOURS
      =================================================== */}

    <div className="treenotes-color-picker-section">

      <div className="treenotes-color-picker-section-title">
        Preset colours
      </div>

      {showNone && (<button type="button" className={`
        treenotes-color-none-button
        ${noneSelected
          ? "is-selected"
          : ""}
        `} disabled={noneDisabled} onClick={() => {
          if (noneDisabled) {
            return;
          }
          onNone?.();
        }} aria-label="No highlight" onMouseEnter={(event) => showTooltip(event, noneDisabled
          ? "Graph-linked text requires a highlight"
          : "Remove highlight")} onMouseLeave={hideTooltip} onFocus={(event) => showTooltip(event, noneDisabled
          ? "Graph-linked text requires a highlight"
          : "Remove highlight")} onBlur={hideTooltip}>
        <Ban size={14} strokeWidth={1.9} />

        <span>
          None
        </span>

        {noneSelected && (<Check size={13} strokeWidth={2.4} />)}
      </button>)}

      <div className="treenotes-color-picker-swatches">

        {PRESET_COLORS.map((color) => {
          const selected = normalizeHex(currentHex) ===
            normalizeHex(color);
          return (<button key={color} type="button" className={`
          treenotes-color-swatch
          ${selected
              ? "is-selected"
              : ""}
          `} style={{
              background: color
            }} onClick={() => commitHex(color)} aria-label={`Select ${color}`} onMouseEnter={(event) => showTooltip(event, color)} onMouseLeave={hideTooltip} onFocus={(event) => showTooltip(event, color)} onBlur={hideTooltip}>

            {selected && (<Check size={13} strokeWidth={2.5} style={{
              color: getContrastColor(color)
            }} />)}

          </button>);
        })}

      </div>

    </div>

    {/* ===================================================
      CUSTOM COLOURS
      =================================================== */}

    <div className="treenotes-color-picker-section">

      <div className="treenotes-color-picker-section-title">
        Custom colours
      </div>

      <div className="treenotes-custom-colors">

        <button 
            type="button" className="treenotes-color-swatch treenotes-custom-color-add"
            onClick={saveCurrentColor}
            aria-label="Save current colour"
            onMouseEnter={(event) => showTooltip(event, "Save current colour")}
            onMouseLeave={hideTooltip}
            onFocus={(event) => showTooltip(event, "Save current colour")}
            onBlur={hideTooltip}>
          <Plus className="treenotes-custom-color-add-icon" size={13} strokeWidth={2} aria-hidden="true" />
        </button>

        {savedColors.map((color) => {

          const selected = normalizeHex(currentHex) === normalizeHex(color);
          return (
            <button
              key={color}
              type="button"
              className={`treenotes-color-swatch${selected ? " is-selected" : ""}`}
              style={{background: color}}
              onClick={() => commitHex(color)}
              onContextMenu={(event) => {
                event.preventDefault();
                hideTooltip();
                removeSavedColor(color);
              }}
              aria-label={`Custom colour ${color}`}
              onMouseEnter={(event) => showTooltip(event, `${color} · Right-click to remove`)}
              onMouseLeave={hideTooltip}
              onFocus={(event) => showTooltip(event, `${color} · Right-click to remove`)}
              onBlur={hideTooltip}>

              {selected && (<Check size={13} strokeWidth={2.5} style={{
                color: getContrastColor(color)
              }} />)}

            </button>);
        })}

      </div>

    </div>

    <div className="treenotes-color-picker-divider" />

    {/* ===================================================
      SATURATION / VALUE
      =================================================== */}

    <div className= "treenotes-color-sv" style={{
      "--treenotes-picker-hue": `hsl(${hsv.h}, 100%, 50%)`
    }} onPointerDown={handleSvPointerDown} onPointerMove={handleSvPointerMove} onPointerUp={handleSvPointerUp}>

      <span className="treenotes-color-sv-thumb" style={{
        left: `${hsv.s}%`,
        top: `${100 - hsv.v}%`
      }} />

    </div>

    {/* ===================================================
      HUE
      =================================================== */}

    <div className="treenotes-color-hue-row">

      <span className="treenotes-current-color" style={{
        background: currentHex
      }} />

      <input className="treenotes-color-hue-slider" type="range" min="0" max="360" value={Math.round(hsv.h)} onChange={(event) => {
        commitHsv({
          ...hsv,
          h: Number(event.target.value)
        });
      }} aria-label="Hue" />

    </div>

    {/* ===================================================
      VALUE TYPE TABS
      =================================================== */}

    <div className="treenotes-color-mode-tabs">

      {[
        "HEX",
        "RGB",
        "HSL"].map((option) => (<button key={option} type="button" className={`
        treenotes-color-mode-tab
        ${mode === option
            ? "is-active"
            : ""}
        `} onClick={() => setMode(option)}>
          {option}
        </button>))}

    </div>

    {/* ===================================================
      HEX INPUT
      =================================================== */}

    {mode === "HEX" && (<div className="treenotes-color-value-single">

      <label>
        HEX
      </label>

      <input type="text" value={hexDraft} maxLength={7} spellCheck={false} onChange={(event) => {
        const next = event.target.value;
        setHexDraft(next);
        if (normalizeHex(next)) {
          commitHex(next);
        }
      }} onBlur={() => setHexDraft(currentHex)} />

    </div>)}

    {/* ===================================================
      RGB INPUTS
      =================================================== */}

    {mode === "RGB" && (<div className="treenotes-color-channel-grid">

      {[
        [
          "R",
          "r"],
        [
          "G",
          "g"],
        [
          "B",
          "b"]].map(([label, channel]) => (<label key={channel}>

            <span>
              {label}
            </span>

            <input type="number" min="0" max="255" value={currentRgb[channel]} onChange={(event) => {
              commitRgb({
                ...currentRgb,
                [channel]: Number(event.target.value)
              });
            }} />

          </label>))}

    </div>)}

    {/* ===================================================
      HSL INPUTS
      =================================================== */}

    {mode === "HSL" && (<div className="treenotes-color-channel-grid">

      {[
        [
          "H",
          "h",
          360],
        [
          "S",
          "s",
          100],
        [
          "L",
          "l",
          100]].map(([label, channel, max]) => (<label key={channel}>

            <span>
              {label}
            </span>

            <input type="number" min="0" max={max} value={currentHsl[channel]} onChange={(event) => {
              commitHsl({
                ...currentHsl,
                [channel]: Number(event.target.value)
              });
            }} />

          </label>))}

    </div>)}

    </div>

    {tooltip && (<div className={`treenotes-picker-tooltip${tooltip.below ? " is-below" : ""}`} style={{
      left: tooltip.left,
      top: tooltip.top
    }} role="tooltip">
      {tooltip.text}
    </div>)}

  </>, document.body);
}