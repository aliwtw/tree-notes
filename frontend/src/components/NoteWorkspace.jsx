import { forwardRef, useEffect, useImperativeHandle, useRef, useState, } from "react";
import usePageTitle from "../hooks/usePageTitle";
import { updateNote } from "../api/notesApi";
import GraphPanel from "./GraphPanel";
import SummaryPanel from "./SummaryPanel";
import TreeNotesColorPicker from "./TreeNotesColorPicker";
import { Bold, Italic, Underline, List, ListOrdered, Link, Search, Notebook, Squircle, Type, Highlighter, Unlink, AlignLeft, AlignCenter, AlignRight, AlignJustify, IndentIncrease, IndentDecrease, ChevronUp, ChevronDown, X, ChevronRight, Replace, Maximize2, Minimize2, Check, Mic, Square, Trash2, Plus, FilePlus2, Languages, } from "lucide-react";
import { LayoutBalancedIcon, LayoutNotesPriorityIcon, LayoutGraphPriorityIcon, LayoutSummaryPriorityIcon, } from "./icons/WorkspaceLayoutIcons";
import FontColorIcon from "./icons/FontColorIcon";
import "./NoteWorkspace.css";
// =========================================================
// WORKSPACE LAYOUT PRESETS
// =========================================================
// Presets only provide useful starting arrangements. The
// user can immediately drag any resize control afterwards;
// once a value no longer matches a preset, the menu reports
// the current arrangement as Custom.
const WORKSPACE_LAYOUT_PRESETS = [
    {
        value: "balanced",
        label: "Balanced",
        Icon: LayoutBalancedIcon,
        notesGraphSplit: 50,
        topPanelsHeight: 480,
        summaryPanelHeight: 264,
    },
    {
        value: "notes-priority",
        label: "Notes Priority",
        Icon: LayoutNotesPriorityIcon,
        notesGraphSplit: 70,
        topPanelsHeight: 650,
        summaryPanelHeight: 264,
    },
    {
        value: "graph-priority",
        label: "Graph Priority",
        Icon: LayoutGraphPriorityIcon,
        notesGraphSplit: 30,
        topPanelsHeight: 650,
        summaryPanelHeight: 264,
    },
    {
        value: "summary-priority",
        label: "Summary Priority",
        Icon: LayoutSummaryPriorityIcon,
        notesGraphSplit: 50,
        topPanelsHeight: 480,
        summaryPanelHeight: 600,
    },
];
// =========================================================
// RAW NOTES TEXT STYLE OPTIONS
// =========================================================
const TEXT_STYLE_PREVIEW_SCALE = 0.74;
const TEXT_STYLE_PREVIEW_MIN_PX = 13.5;
const TEXT_STYLE_PREVIEW_MAX_PX = 20;
const TEXT_STYLE_OPTIONS = [
    {
        value: "p",
        label: "Normal text",
    },
    {
        value: "h1",
        label: "Heading 1",
    },
    {
        value: "h2",
        label: "Heading 2",
    },
    {
        value: "h3",
        label: "Heading 3",
    },
];
const DEFAULT_TEXT_STYLES = {
    p: {
        fontFamily: "inherit",
        fontSize: "16px",
        fontWeight: "400",
        fontStyle: "normal",
        textDecorationLine: "none",
        color: "var(--text-primary)",
        lineHeight: "1.55",
        letterSpacing: "normal",
        textAlign: "left",
    },
    h1: {
        fontFamily: "inherit",
        fontSize: "27px",
        fontWeight: "700",
        fontStyle: "normal",
        textDecorationLine: "none",
        color: "var(--text-primary)",
        lineHeight: "1.25",
        letterSpacing: "normal",
        textAlign: "left",
    },
    h2: {
        fontFamily: "inherit",
        fontSize: "23px",
        fontWeight: "700",
        fontStyle: "normal",
        textDecorationLine: "none",
        color: "var(--text-primary)",
        lineHeight: "1.3",
        letterSpacing: "normal",
        textAlign: "left",
    },
    h3: {
        fontFamily: "inherit",
        fontSize: "19px",
        fontWeight: "700",
        fontStyle: "normal",
        textDecorationLine: "none",
        color: "var(--text-primary)",
        lineHeight: "1.35",
        letterSpacing: "normal",
        textAlign: "left",
    },
};
const FONT_FAMILY_OPTIONS = [
    {
        value: "system-ui",
        label: "System UI",
    },
    {
        value: "Arial",
        label: "Arial",
    },
    {
        value: "Georgia",
        label: "Georgia",
    },
    {
        value: "Times New Roman",
        label: "Times New Roman",
    },
    {
        value: "Verdana",
        label: "Verdana",
    },
    {
        value: "Trebuchet MS",
        label: "Trebuchet MS",
    },
    {
        value: "Courier New",
        label: "Courier New",
    },
];
// =========================================================
// TRANSCRIPTION AUDIO CAPTURE
// =========================================================
// The AudioWorklet converts the microphone's Float32 samples into
// signed 16-bit PCM.
const TRANSCRIPTION_PCM_WORKLET_SOURCE = `
class TreeNotesPcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.levelFrame = 0;
  }

  process(inputs) {
    const channels = inputs[0];

    if (!channels || channels.length === 0 || !channels[0]) {
      return true;
    }

    const input = channels[0];
    const pcm = new Int16Array(input.length);

    let squareSum = 0;

    for (let index = 0; index < input.length; index += 1) {
      const sample = Math.max(-1, Math.min(1, input[index]));

      squareSum += sample * sample;

      pcm[index] =
        sample < 0
          ? sample * 0x8000
          : sample * 0x7fff;
    }

    // AudioWorklet buffers are very small, so only send a level update
    // every few frames while still forwarding every PCM frame.
    this.levelFrame += 1;

    const message = {
      type: "pcm",
      pcm: pcm.buffer,
    };

    if (this.levelFrame >= 4) {
      message.level =
        Math.min(
          1,
          Math.sqrt(squareSum / input.length) * 5
        );

      this.levelFrame = 0;
    }

    this.port.postMessage(
      message,
      [pcm.buffer]
    );

    return true;
  }
}

registerProcessor(
  "treenotes-pcm-capture",
  TreeNotesPcmCaptureProcessor
);
`;
// =========================================================
// TRANSCRIPTION ASR WEBSOCKET
// =========================================================
// The frontend speaks the same small protocol as Vosk's reference
// WebSocket server: JSON config first, binary PCM16 frames while
// listening, then { "eof": 1 } when the session ends.
function getTranscriptionAsrWebSocketUrl() {
    const configuredUrl = import.meta.env.VITE_ASR_WS_URL?.trim();
    if (configuredUrl) {
        return configuredUrl;
    }
    if (typeof window === "undefined") {
        return "ws://localhost:2700";
    }
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.hostname}:2700`;
}
const NoteWorkspace = forwardRef(function NoteWorkspace({ note, onNoteSaved }, ref) {
    // text editor refrence for saving
    const editorRef = useRef(null);
    // graph panel refrence for saving 
    const graphPanelRef = useRef(null);
    // =========================================================
    // WORKSPACE LAYOUT MENU
    // =========================================================
    const layoutDropdownRef = useRef(null);
    const [layoutDropdownOpen, setLayoutDropdownOpen] = useState(false);
    // =========================================================
    // RAW NOTES TEXT STYLE MENU
    // =========================================================
    const textStyleDropdownRef = useRef(null);
    const [textStyleDropdownOpen, setTextStyleDropdownOpen] = useState(false);
    const [textStyles, setTextStyles] = useState(DEFAULT_TEXT_STYLES);
    // font family dropdown// 
    const fontFamilyDropdownRef = useRef(null);
    const [fontFamilyDropdownOpen, setFontFamilyDropdownOpen] = useState(false);
    const [activeFontFamily, setActiveFontFamily] = useState("system-ui");
    const activeFontFamilyLabel = FONT_FAMILY_OPTIONS.find((font) => font.value === activeFontFamily)?.label || activeFontFamily;
    // font size dropdown// 
    const MIN_FONT_SIZE = 8;
    const MAX_FONT_SIZE = 72;
    const [activeFontSize, setActiveFontSize] = useState(16);
    // =========================================================
    // TRANSCRIPTION REVIEW MODAL
    // =========================================================
    // The modal is now backed by a real browser microphone capture pipeline.
    // Audio is captured as mono PCM16 samples so the next stage can forward the
    // same frames directly to the ASR WebSocket service.
    const transcriptionTextareaRef = useRef(null);
    const transcriptionModalOpenRef = useRef(false);
    const transcriptionStreamRef = useRef(null);
    const transcriptionAudioContextRef = useRef(null);
    const transcriptionAudioSourceRef = useRef(null);
    const transcriptionCaptureNodeRef = useRef(null);
    const transcriptionSilentGainRef = useRef(null);
    const transcriptionWorkletUrlRef = useRef(null);
    const transcriptionCaptureRequestRef = useRef(0);
    const transcriptionCapturedSamplesRef = useRef(0);
    const transcriptionCapturedBytesRef = useRef(0);
    const transcriptionCaptureSampleRateRef = useRef(0);
    const transcriptionLastLevelUpdateRef = useRef(0);
    const transcriptionLastCaptureInfoUpdateRef = useRef(0);
    const transcriptionAsrSocketRef = useRef(null);
    const transcriptionAsrCloseTimerRef = useRef(null);
    const transcriptionAsrExpectedCloseRef = useRef(false);
    const transcriptionAsrFinalSegmentsRef = useRef([]);
    const transcriptionAsrPartialRef = useRef("");
    const transcriptionAsrSessionBaseRef = useRef("");
    const [transcriptionModalOpen, setTranscriptionModalOpen] = useState(false);
    const [transcriptionListening, setTranscriptionListening] = useState(false);
    const [transcriptionMicRequesting, setTranscriptionMicRequesting] = useState(false);
    const [transcriptionMicError, setTranscriptionMicError] = useState("");
    const [transcriptionAudioLevel, setTranscriptionAudioLevel] = useState(0);
    const [transcriptionCaptureInfo, setTranscriptionCaptureInfo] = useState(null);
    const [transcriptionAsrState, setTranscriptionAsrState] = useState("idle");
    const [transcriptionAsrError, setTranscriptionAsrError] = useState("");
    const [transcriptionDraft, setTranscriptionDraft] = useState("");
    const [transcriptionTermInput, setTranscriptionTermInput] = useState("");
    const [transcriptionTerms, setTranscriptionTerms] = useState([]);
    function formatTranscriptionCaptureSize(bytes) {
        if (!Number.isFinite(bytes) || bytes <= 0) {
            return "0 KB";
        }
        if (bytes < 1024 * 1024) {
            return `${Math.max(1, Math.round(bytes / 1024))} KB`;
        }
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    function openTranscriptionModal(event) {
        event?.stopPropagation?.();
        transcriptionModalOpenRef.current = true;
        setLayoutDropdownOpen(false);
        setTranscriptionMicError("");
        setTranscriptionAsrError("");
        setTranscriptionAsrState("idle");
        setTranscriptionCaptureInfo(null);
        setTranscriptionAudioLevel(0);
        setTranscriptionModalOpen(true);
    }
    function buildLiveTranscriptionDraft() {
        const base = transcriptionAsrSessionBaseRef.current.trimEnd();
        const finalText = transcriptionAsrFinalSegmentsRef.current
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();
        const partialText = transcriptionAsrPartialRef.current
            .replace(/\s+/g, " ")
            .trim();
        const liveText = [finalText, partialText]
            .filter(Boolean)
            .join(" ")
            .trim();
        if (base && liveText) {
            return `${base}\n\n${liveText}`;
        }
        return base || liveText;
    }
    function updateLiveTranscriptionDraft() {
        setTranscriptionDraft(buildLiveTranscriptionDraft());
    }
    function clearTranscriptionAsrCloseTimer() {
        if (transcriptionAsrCloseTimerRef.current) {
            window.clearTimeout(transcriptionAsrCloseTimerRef.current);
            transcriptionAsrCloseTimerRef.current = null;
        }
    }
    function closeTranscriptionAsrSocket({ finalise = false } = {}) {
        const socket = transcriptionAsrSocketRef.current;
        clearTranscriptionAsrCloseTimer();
        if (!socket) {
            setTranscriptionAsrState("idle");
            return;
        }
        transcriptionAsrExpectedCloseRef.current = true;
        if (finalise && socket.readyState === WebSocket.OPEN) {
            setTranscriptionAsrState("finalising");
            try {
                socket.send('{"eof" : 1}');
                // Vosk normally returns its final result and then closes the
                // connection itself. This timeout prevents a stuck socket if a
                // proxy/backend fails to honour that convention.
                transcriptionAsrCloseTimerRef.current = window.setTimeout(() => {
                    if (transcriptionAsrSocketRef.current === socket && socket.readyState !== WebSocket.CLOSED) {
                        socket.close(1000, "Transcription complete");
                    }
                }, 2500);
                return;
            }
            catch { } // Fall through to a normal close.
        }
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
            try {
                socket.close(1000, "Transcription closed");
            }
            catch { } // Ignore close failures during teardown.
        }
        if (transcriptionAsrSocketRef.current === socket) {
            transcriptionAsrSocketRef.current = null;
        }
        setTranscriptionAsrState("idle");
    }
    function handleTranscriptionAsrMessage(event) {
        if (typeof event.data !== "string") {
            return;
        }
        let message;
        try {
            message = JSON.parse(event.data);
        }
        catch {
            return;
        }
        if (message?.error) {
            setTranscriptionAsrError(String(message.error));
            setTranscriptionAsrState("error");
            return;
        }
        // Native Vosk responses use `partial` for interim text and `text`
        // for accepted/final segments. A future TreeNotes proxy may instead
        // normalise these to { type: "partial|final", text }, so accept both.
        const partialText = typeof message.partial === "string" ? message.partial : message.type === "partial" &&
            typeof message.text === "string" ? message.text : null;
        if (partialText !== null) {
            transcriptionAsrPartialRef.current = partialText;
            updateLiveTranscriptionDraft();
            return;
        }
        const finalText = message.type === "final" &&
            typeof message.text === "string" ? message.text : typeof message.text === "string" ? message.text : "";
        const cleanFinalText = finalText.replace(/\s+/g, " ").trim();
        transcriptionAsrPartialRef.current = "";
        if (cleanFinalText) {
            const finalSegments = transcriptionAsrFinalSegmentsRef.current;
            if (finalSegments[finalSegments.length - 1] !== cleanFinalText) {
                finalSegments.push(cleanFinalText);
            }
        }
        updateLiveTranscriptionDraft();
    }
    function connectTranscriptionAsr(sampleRate, requestId) {
        if (typeof WebSocket === "undefined") {
            return Promise.reject(new Error("This browser does not support WebSocket speech recognition."));
        }
        closeTranscriptionAsrSocket();
        const socketUrl = getTranscriptionAsrWebSocketUrl();
        setTranscriptionAsrError("");
        setTranscriptionAsrState("connecting");
        transcriptionAsrExpectedCloseRef.current = false;
        return new Promise((resolve, reject) => {
            let settled = false;
            let socket;
            try {
                socket = new WebSocket(socketUrl);
            }
            catch (error) {
                setTranscriptionAsrState("error");
                reject(error);
                return;
            }
            transcriptionAsrSocketRef.current = socket;
            socket.binaryType = "arraybuffer";
            const connectionTimeout = window.setTimeout(() => {
                if (settled) {
                    return;
                }
                settled = true;
                try {
                    socket.close();
                }
                catch { } // Ignore timeout close errors.
                reject(new Error(`Timed out connecting to the speech recognition service at ${socketUrl}.`));
            }, 5000);
            socket.onopen = () => {
                if (requestId !== transcriptionCaptureRequestRef.current || !transcriptionModalOpenRef.current) {
                    transcriptionAsrExpectedCloseRef.current = true;
                    socket.close();
                    return;
                }
                window.clearTimeout(connectionTimeout);
                try {
                    socket.send(JSON.stringify({ config: { sample_rate: sampleRate } }));
                }
                catch (error) {
                    if (!settled) {
                        settled = true;
                        reject(error);
                    }
                    return;
                }
                setTranscriptionAsrState("connected");
                if (!settled) {
                    settled = true;
                    resolve(socket);
                }
            };
            socket.onmessage = handleTranscriptionAsrMessage;
            socket.onerror = () => {
                if (!settled) {
                    window.clearTimeout(connectionTimeout);
                    settled = true;
                    reject(new Error(`Unable to connect to the speech recognition service at ${socketUrl}.`));
                }
            };
            socket.onclose = () => {
                window.clearTimeout(connectionTimeout);
                clearTranscriptionAsrCloseTimer();
                if (transcriptionAsrSocketRef.current === socket) {
                    transcriptionAsrSocketRef.current = null;
                }
                const expectedClose = transcriptionAsrExpectedCloseRef.current;
                transcriptionAsrExpectedCloseRef.current = false;
                if (!settled) {
                    settled = true;
                    reject(new Error(`The speech recognition service at ${socketUrl} closed before transcription could start.`));
                    return;
                }
                if (expectedClose) {
                    setTranscriptionAsrState("idle");
                    return;
                }
                if (transcriptionStreamRef.current) {
                    setTranscriptionAsrError("The speech recognition connection closed unexpectedly. Start listening again to reconnect.");
                    setTranscriptionAsrState("error");
                    releaseTranscriptionAudioResources({ keepCaptureSummary: true });
                }
                else {
                    setTranscriptionAsrState("idle");
                }
            };
        });
    }
    function releaseTranscriptionAudioResources({ keepCaptureSummary = true, updateUi = true, } = {}) {
        const sampleRate = transcriptionCaptureSampleRateRef.current;
        const capturedSamples = transcriptionCapturedSamplesRef.current;
        const capturedBytes = transcriptionCapturedBytesRef.current;
        const captureNode = transcriptionCaptureNodeRef.current;
        if (captureNode) {
            try {
                if ("port" in captureNode && captureNode.port) {
                    captureNode.port.onmessage = null;
                }
                if ("onaudioprocess" in captureNode) {
                    captureNode.onaudioprocess = null;
                }
                captureNode.disconnect();
            }
            catch {
                // The node may already have been disconnected.
            }
        }
        if (transcriptionAudioSourceRef.current) {
            try {
                transcriptionAudioSourceRef.current.disconnect();
            }
            catch {
                // The source may already have been disconnected.
            }
        }
        if (transcriptionSilentGainRef.current) {
            try {
                transcriptionSilentGainRef.current.disconnect();
            }
            catch {
                // The gain node may already have been disconnected.
            }
        }
        if (transcriptionStreamRef.current) {
            transcriptionStreamRef.current
                .getTracks()
                .forEach((track) => track.stop());
        }
        const audioContext = transcriptionAudioContextRef.current;
        if (audioContext &&
            audioContext.state !== "closed") {
            audioContext.close().catch(() => { });
        }
        if (transcriptionWorkletUrlRef.current) {
            URL.revokeObjectURL(transcriptionWorkletUrlRef.current);
        }
        transcriptionStreamRef.current = null;
        transcriptionAudioContextRef.current = null;
        transcriptionAudioSourceRef.current = null;
        transcriptionCaptureNodeRef.current = null;
        transcriptionSilentGainRef.current = null;
        transcriptionWorkletUrlRef.current = null;
        if (updateUi) {
            setTranscriptionListening(false);
            setTranscriptionMicRequesting(false);
            setTranscriptionAudioLevel(0);
        }
        if (updateUi &&
            keepCaptureSummary &&
            sampleRate > 0 &&
            capturedSamples > 0) {
            setTranscriptionCaptureInfo({
                durationSeconds: capturedSamples / sampleRate,
                sampleRate,
                bytes: capturedBytes,
                complete: true,
            });
        }
    }
    function stopTranscriptionCapture() {
        // Invalidates a permission request that may still be waiting for the
        // browser/user. If that old request resolves later it will clean itself up.
        transcriptionCaptureRequestRef.current += 1;
        releaseTranscriptionAudioResources({
            keepCaptureSummary: true,
        });
        closeTranscriptionAsrSocket({
            finalise: true,
        });
    }
    function closeTranscriptionModal() {
        transcriptionModalOpenRef.current = false;
        transcriptionCaptureRequestRef.current += 1;
        releaseTranscriptionAudioResources({
            keepCaptureSummary: true,
        });
        closeTranscriptionAsrSocket();
        setTranscriptionModalOpen(false);
    }
    function handleCapturedPcmChunk(pcmChunk, sampleRate, level = null) {
        if (!pcmChunk || pcmChunk.length === 0) {
            return;
        }
        transcriptionCapturedSamplesRef.current +=
            pcmChunk.length;
        transcriptionCapturedBytesRef.current +=
            pcmChunk.byteLength;
        transcriptionCaptureSampleRateRef.current =
            sampleRate;
        const asrSocket = transcriptionAsrSocketRef.current;
        if (asrSocket &&
            asrSocket.readyState === WebSocket.OPEN) {
            try {
                asrSocket.send(pcmChunk.buffer);
            }
            catch (error) {
                console.error("Unable to stream transcription audio:", error);
                setTranscriptionAsrError("Audio capture is active, but the speech recognition service stopped accepting audio.");
                setTranscriptionAsrState("error");
            }
        }
        // PCM frames are streamed immediately and intentionally not retained
        // in browser memory. This keeps long lecture sessions lightweight.
        const now = performance.now();
        if (level !== null &&
            now -
                transcriptionLastLevelUpdateRef.current >=
                45) {
            setTranscriptionAudioLevel(Math.max(0, Math.min(1, level)));
            transcriptionLastLevelUpdateRef.current = now;
        }
        if (now -
            transcriptionLastCaptureInfoUpdateRef.current >=
            220) {
            const capturedSamples = transcriptionCapturedSamplesRef.current;
            const capturedBytes = transcriptionCapturedBytesRef.current;
            setTranscriptionCaptureInfo({
                durationSeconds: sampleRate > 0
                    ? capturedSamples / sampleRate
                    : 0,
                sampleRate,
                bytes: capturedBytes,
                complete: false,
            });
            transcriptionLastCaptureInfoUpdateRef.current = now;
        }
    }
    function convertFloatSamplesToPcm(floatSamples) {
        const pcm = new Int16Array(floatSamples.length);
        let squareSum = 0;
        for (let index = 0; index < floatSamples.length; index += 1) {
            const sample = Math.max(-1, Math.min(1, floatSamples[index]));
            squareSum += sample * sample;
            pcm[index] =
                sample < 0
                    ? sample * 0x8000
                    : sample * 0x7fff;
        }
        const level = Math.min(1, Math.sqrt(squareSum /
            Math.max(1, floatSamples.length)) * 5);
        return {
            pcm,
            level,
        };
    }
    function getMicrophoneErrorMessage(error) {
        switch (error?.name) {
            case "NotAllowedError":
            case "PermissionDeniedError":
                return "Microphone permission was denied. Allow microphone access for TreeNotes in your browser and try again.";
            case "NotFoundError":
            case "DevicesNotFoundError":
                return "No microphone was found. Connect or enable a microphone and try again.";
            case "NotReadableError":
            case "TrackStartError":
                return "The microphone is already in use or could not be opened.";
            case "OverconstrainedError":
            case "ConstraintNotSatisfiedError":
                return "The microphone could not satisfy the requested audio settings.";
            case "SecurityError":
                return "The browser blocked microphone access for this page.";
            case "AbortError":
                return "Microphone capture was interrupted before it could start.";
            default:
                return (error?.message ||
                    "Unable to start microphone capture.");
        }
    }
    async function startTranscriptionCapture() {
        if (transcriptionListening || transcriptionMicRequesting) {
            return;
        }
        if (!navigator.mediaDevices?.getUserMedia) {
            setTranscriptionMicError("Microphone access is unavailable. Use HTTPS or localhost in a browser that supports getUserMedia().");
            return;
        }
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) {
            setTranscriptionMicError("This browser does not support the Web Audio API required for microphone capture.");
            return;
        }
        const requestId = transcriptionCaptureRequestRef.current + 1;
        transcriptionCaptureRequestRef.current = requestId;
        setTranscriptionMicError("");
        setTranscriptionAsrError("");
        setTranscriptionAsrState("idle");
        setTranscriptionMicRequesting(true);
        setTranscriptionCaptureInfo(null);
        setTranscriptionAudioLevel(0);
        transcriptionAsrSessionBaseRef.current = transcriptionDraft.trimEnd();
        transcriptionAsrFinalSegmentsRef.current = [];
        transcriptionAsrPartialRef.current = "";
        transcriptionCapturedSamplesRef.current = 0;
        transcriptionCapturedBytesRef.current = 0;
        transcriptionCaptureSampleRateRef.current = 0;
        transcriptionLastLevelUpdateRef.current = 0;
        transcriptionLastCaptureInfoUpdateRef.current = 0;
        let stream = null;
        let audioContext = null;
        let source = null;
        let captureNode = null;
        let silentGain = null;
        let workletUrl = null;
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
                video: false,
            });
            if (requestId !== transcriptionCaptureRequestRef.current || !transcriptionModalOpenRef.current) {
                stream.getTracks().forEach((track) => track.stop());
                return;
            }
            /*
              Ask for 16 kHz because that is a common ASR rate. Browsers are
              allowed to choose another hardware/context rate, so the actual
              value is always read from audioContext.sampleRate and reported
              to the future backend.
            */
            try {
                audioContext = new AudioContextClass({ sampleRate: 16000 });
            }
            catch {
                audioContext = new AudioContextClass();
            }
            await audioContext.resume();
            await connectTranscriptionAsr(audioContext.sampleRate, requestId);
            source = audioContext.createMediaStreamSource(stream);
            silentGain = audioContext.createGain();
            silentGain.gain.value = 0;
            const canUseAudioWorklet = Boolean(audioContext.audioWorklet) && typeof AudioWorkletNode !== "undefined";
            if (canUseAudioWorklet) {
                workletUrl = URL.createObjectURL(new Blob([TRANSCRIPTION_PCM_WORKLET_SOURCE], { type: "application/javascript" }));
                await audioContext.audioWorklet.addModule(workletUrl);
                captureNode = new AudioWorkletNode(audioContext, "treenotes-pcm-capture", { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1 });
                captureNode.port.onmessage = (event) => {
                    const data = event.data ?? {};
                    if (data.type !== "pcm" || !(data.pcm instanceof ArrayBuffer)) {
                        return;
                    }
                    handleCapturedPcmChunk(new Int16Array(data.pcm), audioContext.sampleRate, Number.isFinite(data.level) ? data.level : null);
                };
            }
            else {
                /*
                  Older-browser fallback. ScriptProcessorNode is deprecated,
                  but it keeps the prototype functional where AudioWorklet is
                  unavailable. Modern Chromium/Firefox/Safari should take the
                  AudioWorklet path above.
                */
                captureNode = audioContext.createScriptProcessor(2048, 1, 1);
                captureNode.onaudioprocess = (event) => {
                    const input = event.inputBuffer.getChannelData(0);
                    const { pcm, level } = convertFloatSamplesToPcm(input);
                    handleCapturedPcmChunk(pcm, audioContext.sampleRate, level);
                };
            }
            source.connect(captureNode);
            captureNode.connect(silentGain);
            silentGain.connect(audioContext.destination);
            transcriptionStreamRef.current = stream;
            transcriptionAudioContextRef.current = audioContext;
            transcriptionAudioSourceRef.current = source;
            transcriptionCaptureNodeRef.current = captureNode;
            transcriptionSilentGainRef.current = silentGain;
            transcriptionWorkletUrlRef.current = workletUrl;
            transcriptionCaptureSampleRateRef.current = audioContext.sampleRate;
            setTranscriptionCaptureInfo({
                durationSeconds: 0,
                sampleRate: audioContext.sampleRate,
                bytes: 0,
                complete: false,
            });
            setTranscriptionListening(true);
        }
        catch (error) {
            console.error("Unable to start microphone capture:", error);
            if (captureNode) {
                try {
                    if ("port" in captureNode && captureNode.port) {
                        captureNode.port.onmessage = null;
                    }
                    if ("onaudioprocess" in captureNode) {
                        captureNode.onaudioprocess = null;
                    }
                    captureNode.disconnect();
                }
                catch { } // Ignore partial setup cleanup failures.
            }
            if (source) {
                try {
                    source.disconnect();
                }
                catch { } // Ignore partial setup cleanup failures.
            }
            if (silentGain) {
                try {
                    silentGain.disconnect();
                }
                catch { } // Ignore partial setup cleanup failures.
            }
            if (stream) {
                stream.getTracks().forEach((track) => track.stop());
            }
            if (audioContext && audioContext.state !== "closed") {
                audioContext.close().catch(() => { });
            }
            if (workletUrl) {
                URL.revokeObjectURL(workletUrl);
            }
            closeTranscriptionAsrSocket();
            if (requestId === transcriptionCaptureRequestRef.current) {
                const isAsrConnectionError = /speech recognition service|WebSocket/i.test(error?.message ?? "");
                if (isAsrConnectionError) {
                    setTranscriptionAsrError(error.message);
                    setTranscriptionAsrState("error");
                }
                else {
                    setTranscriptionMicError(getMicrophoneErrorMessage(error));
                }
                setTranscriptionListening(false);
            }
        }
        finally {
            if (requestId === transcriptionCaptureRequestRef.current) {
                setTranscriptionMicRequesting(false);
            }
        }
    }
    function toggleTranscriptionListening() {
        if (transcriptionListening) {
            stopTranscriptionCapture();
            return;
        }
        startTranscriptionCapture();
    }
    function addTranscriptionTerm() {
        const cleanTerm = transcriptionTermInput.trim();
        if (!cleanTerm) {
            return;
        }
        const alreadyAdded = transcriptionTerms.some((term) => term.toLocaleLowerCase() === cleanTerm.toLocaleLowerCase());
        if (!alreadyAdded) {
            setTranscriptionTerms((current) => [...current, cleanTerm]);
            fetch("/asr/lexicon", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ term: cleanTerm })
            }).catch(() => { });
        }
        setTranscriptionTermInput("");
    }
    function removeTranscriptionTerm(termToRemove) {
        setTranscriptionTerms((current) => current.filter((term) => term !== termToRemove));
        fetch(`/asr/lexicon/${encodeURIComponent(termToRemove)}`, { method: "DELETE" }).catch(() => { });
    }
    function clearTranscriptionDraft() {
        transcriptionAsrSessionBaseRef.current = "";
        transcriptionAsrFinalSegmentsRef.current = [];
        transcriptionAsrPartialRef.current = "";
        setTranscriptionDraft("");
    }
    function appendTranscriptionToNotes() {
        const cleanTranscript = transcriptionDraft.trim();
        const editor = editorRef.current;
        if (!cleanTranscript || !editor) {
            return;
        }
        // Append fresh paragraph blocks so existing rich-text formatting
        // and graph-linked spans remain untouched.
        const paragraphBlocks = cleanTranscript
            .split(/\n\s*\n/)
            .filter((block) => block.trim().length > 0);
        paragraphBlocks.forEach((block) => {
            const paragraph = document.createElement("p");
            const lines = block.split("\n");
            lines.forEach((line, lineIndex) => {
                if (lineIndex > 0) {
                    paragraph.appendChild(document.createElement("br"));
                }
                paragraph.appendChild(document.createTextNode(line));
            });
            editor.appendChild(paragraph);
        });
        updateRawNotes();
        transcriptionModalOpenRef.current = false;
        transcriptionCaptureRequestRef.current += 1;
        releaseTranscriptionAudioResources({
            keepCaptureSummary: true,
        });
        closeTranscriptionAsrSocket();
        setTranscriptionDraft("");
        setTranscriptionModalOpen(false);
        requestAnimationFrame(() => {
            editor.scrollTop = editor.scrollHeight;
            editor.focus();
        });
    }
    // Always release the physical microphone if the workspace unmounts.
    useEffect(() => {
        return () => {
            transcriptionModalOpenRef.current = false;
            transcriptionCaptureRequestRef.current += 1;
            releaseTranscriptionAudioResources({
                keepCaptureSummary: false,
                updateUi: false,
            });
            closeTranscriptionAsrSocket();
        };
    }, []);
    // Escape closes transcription before it can affect workspace Focus
    // Mode. Body scrolling is locked while the modal is open.
    useEffect(() => {
        if (!transcriptionModalOpen) {
            return undefined;
        }
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        function handleTranscriptionEscape(event) {
            if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                closeTranscriptionModal();
            }
        }
        window.addEventListener("keydown", handleTranscriptionEscape, true);
        const focusFrame = requestAnimationFrame(() => {
            transcriptionTextareaRef.current?.focus();
        });
        return () => {
            cancelAnimationFrame(focusFrame);
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", handleTranscriptionEscape, true);
        };
    }, [transcriptionModalOpen]);
    // Match the Profile preferences dropdown behaviour: click
    // outside or press Escape to close the menu.
    useEffect(() => {
        function handleDropdownPointerDown(event) {
            if (layoutDropdownRef.current && !layoutDropdownRef.current.contains(event.target)) {
                setLayoutDropdownOpen(false);
            }
            if (textStyleDropdownRef.current && !textStyleDropdownRef.current.contains(event.target)) {
                setTextStyleDropdownOpen(false);
            }
            if (fontFamilyDropdownRef.current && !fontFamilyDropdownRef.current.contains(event.target)) {
                setFontFamilyDropdownOpen(false);
            }
        }
        function handleDropdownEscape(event) {
            if (event.key === "Escape") {
                setLayoutDropdownOpen(false);
                setTextStyleDropdownOpen(false);
                setFontFamilyDropdownOpen(false);
            }
        }
        document.addEventListener("pointerdown", handleDropdownPointerDown);
        document.addEventListener("keydown", handleDropdownEscape);
        return () => {
            document.removeEventListener("pointerdown", handleDropdownPointerDown);
            document.removeEventListener("keydown", handleDropdownEscape);
        };
    }, []);
    // =========================================================
    // PANEL FOCUS MODE
    // =========================================================
    // null = normal three-panel workspace
    // "notes" / "graph" / "summary" = focused application view
    const [focusedPanel, setFocusedPanel] = useState(null);
    const [focusedPanelHeight, setFocusedPanelHeight] = useState(null);
    function togglePanelFocus(panelName) {
        setFocusedPanel((currentPanel) => currentPanel === panelName
            ? null
            : panelName);
    }
    // Escape always restores the user's previous multi-panel layout.
    useEffect(() => {
        if (!focusedPanel) {
            return undefined;
        }
        function handleFocusEscape(event) {
            if (event.key === "Escape" &&
                !layoutDropdownOpen &&
                !transcriptionModalOpen) {
                setFocusedPanel(null);
            }
        }
        window.addEventListener("keydown", handleFocusEscape);
        return () => {
            window.removeEventListener("keydown", handleFocusEscape);
        };
    }, [focusedPanel, layoutDropdownOpen, transcriptionModalOpen]);
    // Measure the remaining viewport underneath the note title so the
    // focused panel fills the application workspace without invoking
    // the browser Fullscreen API.
    useEffect(() => {
        if (!focusedPanel) {
            setFocusedPanelHeight(null);
            return undefined;
        }
        let frameId = null;
        function updateFocusedPanelHeight() {
            if (frameId !== null) {
                cancelAnimationFrame(frameId);
            }
            frameId = requestAnimationFrame(() => {
                const targetShell = focusedPanel === "summary"
                    ? summaryPanelShellRef.current
                    : topPanelsShellRef.current;
                if (!targetShell) {
                    return;
                }
                const bounds = targetShell.getBoundingClientRect();
                const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
                const availableHeight = Math.max(420, viewportHeight - Math.max(bounds.top, 0) - 18);
                setFocusedPanelHeight(Math.floor(availableHeight));
                requestAnimationFrame(() => {
                    graphPanelRef.current
                        ?.resizeGraph?.();
                });
            });
        }
        updateFocusedPanelHeight();
        window.addEventListener("resize", updateFocusedPanelHeight);
        return () => {
            if (frameId !== null) {
                cancelAnimationFrame(frameId);
            }
            window.removeEventListener("resize", updateFocusedPanelHeight);
        };
    }, [focusedPanel]);
    // =========================================================
    // WORKSPACE PANEL RESIZING
    // =========================================================
    // The desktop Raw Notes / Graph View row itself.
    const notesLayoutRef = useRef(null);
    // Pointer-drag state is kept in a ref so movement remains
    // reliable even between React state updates.
    const notesGraphDraggingRef = useRef(false);
    const NOTES_GRAPH_MIN_SPLIT = 20;
    const NOTES_GRAPH_MAX_SPLIT = 80;
    function clampNotesGraphSplit(value) {
        return Math.min(NOTES_GRAPH_MAX_SPLIT, Math.max(NOTES_GRAPH_MIN_SPLIT, value));
    }
    const [notesGraphSplit, setNotesGraphSplit] = useState(() => {
        if (typeof window === "undefined") {
            return 50;
        }
        const savedSplit = Number(window.localStorage.getItem("treenotes-notes-graph-split"));
        return Number.isFinite(savedSplit)
            ? clampNotesGraphSplit(savedSplit)
            : 50;
    });
    const [isResizingNotesGraph, setIsResizingNotesGraph] = useState(false);
    // ---------------------------------------------------------
    // Shared Raw Notes + Graph View vertical resizing
    // ---------------------------------------------------------
    // Both upper panels always keep the same height. The user can
    // drag one shared grip beneath the row to gain more vertical
    // writing / graph space without stealing height from Summary.
    const topPanelsShellRef = useRef(null);
    const topPanelsDraggingRef = useRef(false);
    const topPanelsPointerOffsetRef = useRef(0);
    const TOP_PANELS_DEFAULT_HEIGHT = 480;
    const TOP_PANELS_MIN_HEIGHT = 480;
    const TOP_PANELS_MAX_HEIGHT = 1000;
    function clampTopPanelsHeight(value) {
        return Math.min(TOP_PANELS_MAX_HEIGHT, Math.max(TOP_PANELS_MIN_HEIGHT, value));
    }
    const [topPanelsHeight, setTopPanelsHeight] = useState(() => {
        if (typeof window === "undefined") {
            return TOP_PANELS_DEFAULT_HEIGHT;
        }
        const savedHeight = Number(window.localStorage.getItem("treenotes-top-panels-height"));
        return Number.isFinite(savedHeight)
            ? clampTopPanelsHeight(savedHeight)
            : TOP_PANELS_DEFAULT_HEIGHT;
    });
    const [isResizingTopPanels, setIsResizingTopPanels] = useState(false);
    // Remember the user's preferred upper workspace height.
    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }
        window.localStorage.setItem("treenotes-top-panels-height", String(topPanelsHeight));
    }, [topPanelsHeight]);
    // Remember the user's preferred desktop split.
    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }
        window.localStorage.setItem("treenotes-notes-graph-split", String(notesGraphSplit));
    }, [notesGraphSplit]);
    // Tell Cytoscape its container changed size.
    // requestAnimationFrame waits until the new grid width has
    // reached the DOM before Cytoscape measures it.
    useEffect(() => {
        const frame = requestAnimationFrame(() => {
            graphPanelRef.current
                ?.resizeGraph?.();
        });
        return () => {
            cancelAnimationFrame(frame);
        };
    }, [notesGraphSplit, topPanelsHeight, focusedPanel, focusedPanelHeight]);
    // Prevent accidental text selection while dragging the divider.
    useEffect(() => {
        if (!isResizingNotesGraph) {
            return undefined;
        }
        const previousCursor = document.body.style.cursor;
        const previousUserSelect = document.body.style.userSelect;
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
        return () => {
            document.body.style.cursor = previousCursor;
            document.body.style.userSelect = previousUserSelect;
        };
    }, [isResizingNotesGraph]);
    function getTextStyleStorageKey(noteId) {
        return `treenotes:text-styles:${noteId}`;
    }
    function normaliseStoredTextStyles(storedStyles) {
        return {
            p: {
                ...DEFAULT_TEXT_STYLES.p,
                ...(storedStyles?.p || {}),
            },
            h1: {
                ...DEFAULT_TEXT_STYLES.h1,
                ...(storedStyles?.h1 || {}),
            },
            h2: {
                ...DEFAULT_TEXT_STYLES.h2,
                ...(storedStyles?.h2 || {}),
            },
            h3: {
                ...DEFAULT_TEXT_STYLES.h3,
                ...(storedStyles?.h3 || {}),
            },
        };
    }
    function persistTextStyles(nextStyles) {
        if (!note?.id) {
            return;
        }
        try {
            localStorage.setItem(getTextStyleStorageKey(note.id), JSON.stringify(nextStyles));
        }
        catch (error) {
            console.warn("Unable to save text styles:", error);
        }
    }
    useEffect(() => {
        if (!note?.id) {
            setTextStyles(normaliseStoredTextStyles(null));
            return;
        }
        try {
            const storedValue = localStorage.getItem(getTextStyleStorageKey(note.id));
            const storedStyles = storedValue
                ? JSON.parse(storedValue)
                : null;
            setTextStyles(normaliseStoredTextStyles(storedStyles));
        }
        catch (error) {
            console.warn("Unable to load text styles:", error);
            setTextStyles(normaliseStoredTextStyles(null));
        }
    }, [note?.id]);
    function getTextStylePreview(styleKey) {
        const style = textStyles[styleKey] || DEFAULT_TEXT_STYLES[styleKey];
        const parsedFontSize = parseFloat(style.fontSize);
        const previewFontSize = Number.isFinite(parsedFontSize)
            ? Math.min(TEXT_STYLE_PREVIEW_MAX_PX, Math.max(TEXT_STYLE_PREVIEW_MIN_PX, parsedFontSize * TEXT_STYLE_PREVIEW_SCALE))
            : undefined;
        return {
            fontFamily: style.fontFamily === "inherit"
                ? undefined
                : style.fontFamily,
            fontSize: previewFontSize
                ? `${previewFontSize}px`
                : undefined,
            fontWeight: style.fontWeight,
            fontStyle: style.fontStyle,
            textDecorationLine: style.textDecorationLine,
            textAlign: style.textAlign,
            color: style.color,
            letterSpacing: style.letterSpacing,
            lineHeight: 1.24,
        };
    }
    function updateNotesGraphSplit(clientX) {
        const layout = notesLayoutRef.current;
        if (!layout) {
            return;
        }
        const bounds = layout.getBoundingClientRect();
        if (bounds.width <= 0) {
            return;
        }
        const pointerX = clientX - bounds.left;
        const nextSplit = (pointerX / bounds.width) * 100;
        setNotesGraphSplit(clampNotesGraphSplit(nextSplit));
    }
    function finishNotesGraphResize(event) {
        if (!notesGraphDraggingRef.current) {
            return;
        }
        notesGraphDraggingRef.current = false;
        setIsResizingNotesGraph(false);
        if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
    }
    function handleNotesGraphResizeKeyDown(event) {
        let nextSplit = null;
        if (event.key === "ArrowLeft") {
            nextSplit = notesGraphSplit - 5;
        }
        else if (event.key === "ArrowRight") {
            nextSplit = notesGraphSplit + 5;
        }
        else if (event.key === "Home") {
            nextSplit = NOTES_GRAPH_MIN_SPLIT;
        }
        else if (event.key === "End") {
            nextSplit = NOTES_GRAPH_MAX_SPLIT;
        }
        if (nextSplit === null) {
            return;
        }
        event.preventDefault();
        setNotesGraphSplit(clampNotesGraphSplit(nextSplit));
    }
    // Prevent text selection while dragging the shared bottom edge.
    useEffect(() => {
        if (!isResizingTopPanels) {
            return undefined;
        }
        const previousCursor = document.body.style.cursor;
        const previousUserSelect = document.body.style.userSelect;
        document.body.style.cursor = "row-resize";
        document.body.style.userSelect = "none";
        return () => {
            document.body.style.cursor = previousCursor;
            document.body.style.userSelect = previousUserSelect;
        };
    }, [isResizingTopPanels]);
    function updateTopPanelsHeight(clientY) {
        const shell = topPanelsShellRef.current;
        if (!shell) {
            return;
        }
        const bounds = shell.getBoundingClientRect();
        const nextHeight = clientY -
            bounds.top -
            topPanelsPointerOffsetRef.current;
        setTopPanelsHeight(clampTopPanelsHeight(nextHeight));
    }
    function finishTopPanelsResize(event) {
        if (!topPanelsDraggingRef.current) {
            return;
        }
        topPanelsDraggingRef.current = false;
        setIsResizingTopPanels(false);
        if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
    }
    function handleTopPanelsResizeKeyDown(event) {
        let nextHeight = null;
        if (event.key === "ArrowUp") {
            nextHeight = topPanelsHeight - 24;
        }
        else if (event.key === "ArrowDown") {
            nextHeight = topPanelsHeight + 24;
        }
        else if (event.key === "PageUp") {
            nextHeight = topPanelsHeight - 100;
        }
        else if (event.key === "PageDown") {
            nextHeight = topPanelsHeight + 100;
        }
        else if (event.key === "Home") {
            nextHeight = TOP_PANELS_MIN_HEIGHT;
        }
        else if (event.key === "End") {
            nextHeight = TOP_PANELS_MAX_HEIGHT;
        }
        if (nextHeight === null) {
            return;
        }
        event.preventDefault();
        setTopPanelsHeight(clampTopPanelsHeight(nextHeight));
    }
    // ---------------------------------------------------------
    // Summary panel vertical resizing
    // ---------------------------------------------------------
    // The Summary keeps its current compact size by default, but the
    // user can pull its bottom edge downward whenever they want more
    // writing room. The textarea still keeps its own internal scrollbar.
    const summaryPanelShellRef = useRef(null);
    const summaryPanelDraggingRef = useRef(false);
    const summaryPanelPointerOffsetRef = useRef(0);
    const SUMMARY_PANEL_MIN_HEIGHT = 264;
    const SUMMARY_PANEL_MAX_HEIGHT = 1200;
    function clampSummaryPanelHeight(value) {
        return Math.min(SUMMARY_PANEL_MAX_HEIGHT, Math.max(SUMMARY_PANEL_MIN_HEIGHT, value));
    }
    const [summaryPanelHeight, setSummaryPanelHeight] = useState(() => {
        if (typeof window === "undefined") {
            return SUMMARY_PANEL_MIN_HEIGHT;
        }
        const savedHeight = Number(window.localStorage.getItem("treenotes-summary-panel-height"));
        return Number.isFinite(savedHeight)
            ? clampSummaryPanelHeight(savedHeight)
            : SUMMARY_PANEL_MIN_HEIGHT;
    });
    const [isResizingSummaryPanel, setIsResizingSummaryPanel] = useState(false);
    // Remember the user's preferred Summary height.
    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }
        window.localStorage.setItem("treenotes-summary-panel-height", String(summaryPanelHeight));
    }, [summaryPanelHeight]);
    // Prevent text selection while dragging the Summary edge.
    useEffect(() => {
        if (!isResizingSummaryPanel) {
            return undefined;
        }
        const previousCursor = document.body.style.cursor;
        const previousUserSelect = document.body.style.userSelect;
        document.body.style.cursor = "row-resize";
        document.body.style.userSelect = "none";
        return () => {
            document.body.style.cursor = previousCursor;
            document.body.style.userSelect = previousUserSelect;
        };
    }, [isResizingSummaryPanel]);
    function updateSummaryPanelHeight(clientY) {
        const shell = summaryPanelShellRef.current;
        if (!shell) {
            return;
        }
        const bounds = shell.getBoundingClientRect();
        const nextHeight = clientY -
            bounds.top -
            summaryPanelPointerOffsetRef.current;
        setSummaryPanelHeight(clampSummaryPanelHeight(nextHeight));
    }
    function finishSummaryPanelResize(event) {
        if (!summaryPanelDraggingRef.current) {
            return;
        }
        summaryPanelDraggingRef.current = false;
        setIsResizingSummaryPanel(false);
        if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
    }
    function handleSummaryPanelResizeKeyDown(event) {
        let nextHeight = null;
        if (event.key === "ArrowUp") {
            nextHeight = summaryPanelHeight - 24;
        }
        else if (event.key === "ArrowDown") {
            nextHeight = summaryPanelHeight + 24;
        }
        else if (event.key === "PageUp") {
            nextHeight = summaryPanelHeight - 100;
        }
        else if (event.key === "PageDown") {
            nextHeight = summaryPanelHeight + 100;
        }
        else if (event.key === "Home") {
            nextHeight = SUMMARY_PANEL_MIN_HEIGHT;
        }
        else if (event.key === "End") {
            nextHeight = SUMMARY_PANEL_MAX_HEIGHT;
        }
        if (nextHeight === null) {
            return;
        }
        event.preventDefault();
        setSummaryPanelHeight(clampSummaryPanelHeight(nextHeight));
    }
    // ---------------------------------------------------------
    // Layout preset detection / application
    // ---------------------------------------------------------
    const activeLayoutPreset = WORKSPACE_LAYOUT_PRESETS.find((preset) => Math.abs(notesGraphSplit -
        preset.notesGraphSplit) < 0.5 &&
        Math.abs(topPanelsHeight -
            preset.topPanelsHeight) < 1 &&
        Math.abs(summaryPanelHeight -
            preset.summaryPanelHeight) < 1) ?? null;
    const activeLayoutValue = activeLayoutPreset?.value ??
        "custom";
    const activeLayoutLabel = activeLayoutPreset?.label ??
        "Custom";
    // Focus Mode temporarily takes precedence over the underlying
    // preset/custom label. The stored draggable values stay untouched,
    // so restoring focus immediately reveals the correct layout again.
    const workspaceLayoutDisplayValue = focusedPanel
        ? "focused"
        : activeLayoutValue;
    const workspaceLayoutDisplayLabel = focusedPanel
        ? "Focused"
        : activeLayoutLabel;
    // Use the custom layout artwork for known presets. Custom keeps
    // the generic Cornell-style Balanced icon, while Focus Mode uses
    // Maximize2 because it is a temporary single-panel state rather
    // than another three-panel preset.
    const WorkspaceLayoutTriggerIcon = focusedPanel
        ? Maximize2
        : activeLayoutPreset?.Icon ??
            LayoutBalancedIcon;
    function applyWorkspaceLayout(preset) {
        setNotesGraphSplit(clampNotesGraphSplit(preset.notesGraphSplit));
        setTopPanelsHeight(clampTopPanelsHeight(preset.topPanelsHeight));
        setSummaryPanelHeight(clampSummaryPanelHeight(preset.summaryPanelHeight));
        // A layout preset describes the multi-panel workspace,
        // so selecting one also returns from Focus Mode.
        setFocusedPanel(null);
        setLayoutDropdownOpen(false);
    }
    // Stores the current text selection while using colour pickers
    const savedSelectionRef = useRef(null);
    // Current selected toolbar colours
    const [textColor, setTextColor] = useState("#eef1f7");
    const [highlightColor, setHighlightColor] = useState("#625df0");
    // Custom Text Colour picker
    const textColorButtonRef = useRef(null);
    const [textColorPickerOpen, setTextColorPickerOpen] = useState(false);
    // Custom Highlight Colour picker
    const highlightColorButtonRef = useRef(null);
    const [highlightColorPickerOpen, setHighlightColorPickerOpen] = useState(false);
    const [highlightNoneDisabled, setHighlightNoneDisabled] = useState(false);
    // Custom Link Highlight Colour picker
    const linkHighlightButtonRef = useRef(null);
    const [linkHighlightPickerOpen, setLinkHighlightPickerOpen] = useState(false);
    // Current formatting colours at the editor cursor
    const [activeTextColor, setActiveTextColor] = useState("#eef1f7");
    const [activeHighlightColor, setActiveHighlightColor] = useState(null);
    // Controls alignment / indent popover
    const [paragraphMenuOpen, setParagraphMenuOpen] = useState(false);
    // Used for detecting clicks outside the popover
    const paragraphMenuRef = useRef(null);
    // Stores current paragraph alignment
    const [activeAlignment, setActiveAlignment] = useState("left");
    const selectedRangeRef = useRef(null);
    const graphLinkColourIndexRef = useRef(0);
    const [linkedTextNavigator, setLinkedTextNavigator] = useState(null);
    /*
      =========================================================
      ACCESSIBLE GRAPH LINK COLOURS
      =========================================================
    
      The actual colours live in themes.css.
    
      This means the default colours used for Raw Notes
      graph links automatically follow:
    
      - Standard
      - Deuteranopia
      - Protanopia
      - Tritanopia
    
      as well as light/dark mode.
    */
    const GRAPH_LINK_COLOR_TOKENS = [
        "--graph-link-1",
        "--graph-link-2",
        "--graph-link-3",
        "--graph-link-4",
    ];
    /*
      Known colours from our current automatic palettes.
    
      This allows links created before we added palette-slot
      metadata to be adopted into the new system where possible.
    
      Unknown colours are assumed to have been manually chosen
      and are preserved.
    */
    const KNOWN_GRAPH_LINK_COLOURS_BY_SLOT = [
        [
            "#55cddd",
            "#1677a6",
            "#56b4e9",
            "#0072b2",
            "#67c5e8",
            "#16779b",
            "#63d19e",
            "#18754f",
            // older automatic colours
            "#56ccf2",
            "#f58b8b",
        ],
        [
            "#f2c94c",
            "#9a6500",
            "#f0b84b",
            "#f4bd61",
            "#926000",
            "#ef9d67",
            "#a34f20",
            // older automatic colour
            "#f2994a",
        ],
        [
            "#ca6be6",
            "#8a4fa3",
            "#cc79a7",
            "#8c4f7c",
            "#e879b7",
            "#a8447c",
            "#d58bd2",
            "#965891",
            // older automatic colours
            "#9b7df5",
            "#bb6bd9",
        ],
        [
            "#ef7d7d",
            "#c53c3c",
            "#e8e8e8",
            "#4f5968",
            "#a78bfa",
            "#6554b8",
            "#ef7474",
            "#b63d48",
            // older automatic colours
            "#4fd1a1",
            "#60a5fa",
        ],
    ];
    function getGraphLinkPalette() {
        const styles = getComputedStyle(document.documentElement);
        return GRAPH_LINK_COLOR_TOKENS.map((token) => styles
            .getPropertyValue(token)
            .trim());
    }
    function inferGraphLinkPaletteSlot(colour) {
        if (!colour) {
            return null;
        }
        const normalisedColour = colour
            .trim()
            .toLowerCase();
        for (let slot = 0; slot <
            KNOWN_GRAPH_LINK_COLOURS_BY_SLOT.length; slot += 1) {
            if (KNOWN_GRAPH_LINK_COLOURS_BY_SLOT[slot].includes(normalisedColour)) {
                return slot;
            }
        }
        return null;
    }
    // << RAW NOTES SEARCH >> //
    // << frontend dev >> //
    // Stores the current note title //
    const [title, setTitle] = useState(note.title ?? "Untitled Note");
    /*
      Keep the browser tab title synced
      with the currently open note.
    */
    usePageTitle(title?.trim()
        ? title
        : "Untitled Note");
    // Stores the current raw note text //
    // This rawNotes value will be shared with HANS AI //
    const [rawNotes, setRawNotes] = useState(note.notes_section ??
        note.content ??
        "");
    // Stores the current raw note text in HTML format //
    const [rawNotesHtml, setRawNotesHtml] = useState(note.notes_section_html ??
        "");
    // Stored user/AI summary for this note.
    const [summary, setSummary] = useState(note.summary_section ??
        note.summary ??
        "");
    // Selected text for manually adding to graph //
    const [selectedText, setSelectedText] = useState("");
    // Initialising Context menu on right click //
    const [contextMenu, setContextMenu] = useState(null);
    // Current live graph nodes shown in the graph-node submenus.
    const [graphNodeOptions, setGraphNodeOptions] = useState([]);
    const [graphNodeMenuOpen, setGraphNodeMenuOpen] = useState(false);
    const [graphNodeSearch, setGraphNodeSearch] = useState("");
    const filteredGraphNodeOptions = graphNodeOptions.filter((node) => {
        const query = graphNodeSearch.trim().toLowerCase();
        if (!query) {
            return true;
        }
        return String(node.label || "")
            .toLowerCase()
            .includes(query);
    });
    const [addNodeTrigger, setAddNodeTrigger] = useState(0);
    // Tracks the active text formatting //
    const [activeFormats, setActiveFormats] = useState({
        bold: false,
        italic: false,
        underline: false,
        heading: null,
        bulletList: false,
        numberedList: false,
    });
    // =========================================================
    // CURRENT TEXT STYLE
    // =========================================================
    const activeTextStyleValue = activeFormats.heading || "p";
    const activeTextStyleLabel = TEXT_STYLE_OPTIONS.find((option) => option.value === activeTextStyleValue)?.label || "Normal text";
    // =========================================================
    // SAVED TEXT STYLE CSS VARIABLES
    // =========================================================
    const textStyleVariables = {
        "--note-p-font-family": textStyles.p.fontFamily,
        "--note-p-font-size": textStyles.p.fontSize,
        "--note-p-font-weight": textStyles.p.fontWeight,
        "--note-p-font-style": textStyles.p.fontStyle,
        "--note-p-text-decoration": textStyles.p.textDecorationLine,
        "--note-p-color": textStyles.p.color,
        "--note-p-line-height": textStyles.p.lineHeight,
        "--note-p-letter-spacing": textStyles.p.letterSpacing,
        "--note-p-text-align": textStyles.p.textAlign,
        "--note-h1-font-family": textStyles.h1.fontFamily,
        "--note-h1-font-size": textStyles.h1.fontSize,
        "--note-h1-font-weight": textStyles.h1.fontWeight,
        "--note-h1-font-style": textStyles.h1.fontStyle,
        "--note-h1-text-decoration": textStyles.h1.textDecorationLine,
        "--note-h1-color": textStyles.h1.color,
        "--note-h1-line-height": textStyles.h1.lineHeight,
        "--note-h1-letter-spacing": textStyles.h1.letterSpacing,
        "--note-h1-text-align": textStyles.h1.textAlign,
        "--note-h2-font-family": textStyles.h2.fontFamily,
        "--note-h2-font-size": textStyles.h2.fontSize,
        "--note-h2-font-weight": textStyles.h2.fontWeight,
        "--note-h2-font-style": textStyles.h2.fontStyle,
        "--note-h2-text-decoration": textStyles.h2.textDecorationLine,
        "--note-h2-color": textStyles.h2.color,
        "--note-h2-line-height": textStyles.h2.lineHeight,
        "--note-h2-letter-spacing": textStyles.h2.letterSpacing,
        "--note-h2-text-align": textStyles.h2.textAlign,
        "--note-h3-font-family": textStyles.h3.fontFamily,
        "--note-h3-font-size": textStyles.h3.fontSize,
        "--note-h3-font-weight": textStyles.h3.fontWeight,
        "--note-h3-font-style": textStyles.h3.fontStyle,
        "--note-h3-text-decoration": textStyles.h3.textDecorationLine,
        "--note-h3-color": textStyles.h3.color,
        "--note-h3-line-height": textStyles.h3.lineHeight,
        "--note-h3-letter-spacing": textStyles.h3.letterSpacing,
        "--note-h3-text-align": textStyles.h3.textAlign,
    };
    const alignmentIcons = {
        left: AlignLeft,
        center: AlignCenter,
        right: AlignRight,
        justify: AlignJustify,
    };
    const ActiveAlignmentIcon = alignmentIcons[activeAlignment] || AlignLeft;
    /* ---------------------------------------------------------
     Raw Notes Formatting
     --------------------------------------------------------- */
    function runFormat(command, value = null) {
        editorRef.current?.focus();
        document.execCommand(command, false, value);
        updateRawNotes();
        updateFormattingState();
    }
    function applyFontFamily(fontFamily) {
        editorRef.current?.focus();
        document.execCommand("fontName", false, fontFamily);
        setActiveFontFamily(fontFamily);
        updateRawNotes();
        updateFormattingState();
        setFontFamilyDropdownOpen(false);
    }
    function applyFontSize(fontSize) {
        const nextSize = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, fontSize));
        editorRef.current?.focus();
        document.execCommand("fontSize", false, "7");
        const editor = editorRef.current;
        if (editor) {
            editor
                .querySelectorAll('font[size="7"]')
                .forEach((element) => {
                element.removeAttribute("size");
                element.style.fontSize = `${nextSize}px`;
            });
        }
        setActiveFontSize(nextSize);
        updateRawNotes();
        updateFormattingState();
    }
    function getCurrentEditorSelectionElement() {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            return null;
        }
        let node = selection.anchorNode;
        if (node?.nodeType === Node.TEXT_NODE) {
            node = node.parentElement;
        }
        if (!(node instanceof Element) ||
            !editorRef.current?.contains(node)) {
            return null;
        }
        return node;
    }
    function updateFormattingState() {
        let currentBlock = document.queryCommandValue("formatBlock");
        if (currentBlock) {
            currentBlock = currentBlock
                .toLowerCase()
                .replace("<", "")
                .replace(">", "");
        }
        const editorBlock = getCurrentEditorBlock();
        const blockHasUnderline = editorBlock
            ? window
                .getComputedStyle(editorBlock)
                .textDecorationLine
                .includes("underline")
            : false;
        /*
          Read the caret/selection target NOW rather than using a value
          captured during the previous React render. This keeps font family
          and font size in sync as soon as the cursor enters different text.
        */
        const selectionElement = getCurrentEditorSelectionElement();
        if (selectionElement) {
            const computedStyle = window.getComputedStyle(selectionElement);
            // Font family
            const rawFontFamily = computedStyle.fontFamily || "Arial";
            const cleanFontFamily = rawFontFamily
                .split(",")[0]
                .replace(/["']/g, "")
                .trim();
            const matchedFont = FONT_FAMILY_OPTIONS.find((font) => font.value.toLowerCase() ===
                cleanFontFamily.toLowerCase());
            setActiveFontFamily(matchedFont?.value || cleanFontFamily);
            // Font size
            const parsedFontSize = parseFloat(computedStyle.fontSize);
            if (Number.isFinite(parsedFontSize)) {
                setActiveFontSize(Math.round(parsedFontSize));
            }
        }
        setActiveFormats({
            bold: document.queryCommandState("bold"),
            italic: document.queryCommandState("italic"),
            underline: document.queryCommandState("underline") ||
                blockHasUnderline,
            heading: currentBlock === "h1" ||
                currentBlock === "h2" ||
                currentBlock === "h3"
                ? currentBlock
                : null,
            bulletList: document.queryCommandState("insertUnorderedList"),
            numberedList: document.queryCommandState("insertOrderedList"),
        });
        // Update alignment state
        updateAlignmentState();
        // Update text/highlight colour indicators
        updateActiveColors();
    }
    function getCurrentEditorBlock() {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            return null;
        }
        let target = selection.anchorNode;
        if (target?.nodeType === Node.TEXT_NODE) {
            target = target.parentElement;
        }
        if (!(target instanceof Element) || !editorRef.current?.contains(target)) {
            return null;
        }
        return target.closest("p, h1, h2, h3, div");
    }
    function getTextStyleKeyForBlock(block) {
        if (!block) {
            return "p";
        }
        const tagName = block.tagName.toLowerCase();
        if (tagName === "h1" || tagName === "h2" || tagName === "h3") {
            return tagName;
        }
        return "p";
    }
    function clearTextStyleOverrides(block) {
        if (!block) {
            return;
        }
        /*
          These are properties controlled by our
          Normal / Heading style presets.
    
          Remove old inline character formatting so
          the newly selected style can inherit its
          saved values correctly.
        */
        const managedProperties = [
            "color",
            "font-family",
            "font-size",
            "font-weight",
            "font-style",
            "line-height",
            "letter-spacing",
            "text-align",
            "text-decoration",
            "text-decoration-line",
            "text-decoration-color",
            "text-decoration-style",
            "text-decoration-thickness",
        ];
        const elements = [
            block,
            ...block.querySelectorAll("*"),
        ];
        elements.forEach((element) => {
            if (!(element instanceof HTMLElement)) {
                return;
            }
            managedProperties.forEach((property) => {
                element.style.removeProperty(property);
            });
            /*
              execCommand can create legacy <font>
              elements instead of spans.
      
              Remove the equivalent old HTML attributes
              as well.
            */
            if (element.tagName === "FONT") {
                element.removeAttribute("color");
                element.removeAttribute("face");
                element.removeAttribute("size");
            }
            /*
              Avoid leaving empty style="" attributes
              littered through the saved note HTML.
            */
            if (element.hasAttribute("style") && !element.getAttribute("style")?.trim()) {
                element.removeAttribute("style");
            }
        });
        /*
          execCommand may represent bold / italic / underline
          as actual HTML elements rather than inline CSS.
    
          Remove those wrappers while preserving everything
          inside them.
        */
        const formattingElements = Array.from(block.querySelectorAll("b, strong, i, em, u"));
        formattingElements.forEach((element) => {
            const parent = element.parentNode;
            if (!parent) {
                return;
            }
            while (element.firstChild) {
                parent.insertBefore(element.firstChild, element);
            }
            element.remove();
        });
    }
    function applyTextStyle(blockType) {
        editorRef.current?.focus();
        /*
          Change the semantic block first.
        */
        document.execCommand("formatBlock", false, blockType);
        /*
          Then remove old inline font styling from
          the converted block.
    
          This allows the saved target style to take
          control through the CSS variables.
        */
        const currentBlock = getCurrentEditorBlock();
        clearTextStyleOverrides(currentBlock);
        updateRawNotes();
        updateFormattingState();
        setTextStyleDropdownOpen(false);
    }
    function getCurrentEditorStyle() {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            return null;
        }
        let target = selection.anchorNode;
        if (target?.nodeType === Node.TEXT_NODE) {
            target = target.parentElement;
        }
        if (!(target instanceof Element) || !editorRef.current?.contains(target)) {
            return null;
        }
        const block = target.closest("p, h1, h2, h3, div");
        if (!block) {
            return null;
        }
        const inlineStyle = window.getComputedStyle(target);
        const blockStyle = window.getComputedStyle(block);
        const isBold = document.queryCommandState("bold");
        const isItalic = document.queryCommandState("italic");
        const isUnderlined = document.queryCommandState("underline");
        return {
            fontFamily: inlineStyle.fontFamily,
            fontSize: inlineStyle.fontSize,
            fontWeight: isBold
                ? "700"
                : "400",
            fontStyle: isItalic
                ? "italic"
                : "normal",
            textDecorationLine: isUnderlined
                ? "underline"
                : "none",
            color: inlineStyle.color,
            lineHeight: blockStyle.lineHeight,
            letterSpacing: inlineStyle.letterSpacing,
            textAlign: blockStyle.textAlign,
        };
    }
    function updateTextStyleToMatch(styleKey) {
        const currentBlock = getCurrentEditorBlock();
        const capturedStyle = getCurrentEditorStyle();
        if (!capturedStyle) {
            return;
        }
        const nextStyles = {
            ...textStyles,
            [styleKey]: {
                ...textStyles[styleKey],
                ...capturedStyle,
            },
        };
        setTextStyles(nextStyles);
        persistTextStyles(nextStyles);
        /*
          Now that these values live in the saved style,
          remove the source block's duplicate inline
          typography.
    
          The heading will then inherit the same preset
          as every other heading of this type.
        */
        if (currentBlock && getTextStyleKeyForBlock(currentBlock) === styleKey) {
            clearTextStyleOverrides(currentBlock);
        }
        updateRawNotes();
        requestAnimationFrame(() => {
            updateFormattingState();
        });
        setTextStyleDropdownOpen(false);
    }
    function resetTextStyle(styleKey) {
        const currentBlock = getCurrentEditorBlock();
        const nextStyles = {
            ...textStyles,
            [styleKey]: {
                ...DEFAULT_TEXT_STYLES[styleKey],
            },
        };
        setTextStyles(nextStyles);
        persistTextStyles(nextStyles);
        /*
          If the cursor is currently inside the style
          being reset, clear its local overrides too.
    
          This fixes the previous behavior where every
          other H2 reset but the current H2 did not.
        */
        if (currentBlock && getTextStyleKeyForBlock(currentBlock) === styleKey) {
            clearTextStyleOverrides(currentBlock);
        }
        updateRawNotes();
        requestAnimationFrame(() => {
            updateFormattingState();
        });
        setTextStyleDropdownOpen(false);
    }
    function updateRawNotes() {
        if (!editorRef.current) {
            return;
        }
        // Plain text for Hans / AI
        setRawNotes(editorRef.current.innerText);
        // Rich content for saving formatting + graph links
        setRawNotesHtml(editorRef.current.innerHTML);
    }
    function addLink() {
        const url = window.prompt("Enter a URL:");
        if (!url) {
            return;
        }
        editorRef.current?.focus();
        document.execCommand("createLink", false, url);
        updateRawNotes();
    }
    function hexToRgba(hex, alpha = 1) {
        let cleanHex = hex.replace("#", "");
        if (cleanHex.length === 3) {
            cleanHex =
                cleanHex
                    .split("")
                    .map((character) => character + character)
                    .join("");
        }
        const red = parseInt(cleanHex.substring(0, 2), 16);
        const green = parseInt(cleanHex.substring(2, 4), 16);
        const blue = parseInt(cleanHex.substring(4, 6), 16);
        return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
    }
    function cssColorToHex(color, fallback = "#eef1f7") {
        if (!color) {
            return fallback;
        }
        if (color.startsWith("#")) {
            return color;
        }
        const rgbMatch = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/);
        if (!rgbMatch) {
            return fallback;
        }
        // Transparent colour
        if (rgbMatch[4] !== undefined &&
            Number(rgbMatch[4]) === 0) {
            return null;
        }
        const red = Number(rgbMatch[1]);
        const green = Number(rgbMatch[2]);
        const blue = Number(rgbMatch[3]);
        return ("#" +
            [red, green, blue]
                .map((value) => value
                .toString(16)
                .padStart(2, "0"))
                .join(""));
    }
    function updateActiveColors() {
        const selection = window.getSelection();
        if (!selection ||
            selection.rangeCount === 0 ||
            !editorRef.current) {
            return;
        }
        let currentNode = selection.anchorNode;
        if (!currentNode) {
            return;
        }
        // If the cursor is inside a text node,
        // use its parent HTML element.
        let currentElement = currentNode.nodeType === Node.TEXT_NODE
            ? currentNode.parentElement
            : currentNode;
        if (!currentElement ||
            !editorRef.current.contains(currentElement)) {
            return;
        }
        // =====================================================
        // TEXT COLOUR
        // =====================================================
        const computedStyle = window.getComputedStyle(currentElement);
        const currentTextColor = cssColorToHex(computedStyle.color, "#eef1f7");
        if (currentTextColor) {
            setActiveTextColor(currentTextColor);
            setTextColor(currentTextColor);
        }
        // =====================================================
        // HIGHLIGHT COLOUR
        // =====================================================
        /*
          execCommand("hiliteColor") normally creates
          a span with an inline background colour.
    
          Walk upward from the cursor until we either find
          one or reach the editor itself.
        */
        const graphLinkedText = currentElement?.closest?.(".graph-linked-text");
        if (graphLinkedText &&
            editorRef.current.contains(graphLinkedText)) {
            const graphLinkColor = graphLinkedText.dataset
                .graphLinkColor;
            if (graphLinkColor) {
                setActiveHighlightColor(graphLinkColor);
                setHighlightColor(graphLinkColor);
                return;
            }
        }
        let highlightElement = currentElement;
        let foundHighlight = null;
        while (highlightElement &&
            highlightElement !==
                editorRef.current) {
            const inlineBackground = highlightElement.style
                ?.backgroundColor;
            if (inlineBackground &&
                inlineBackground !==
                    "transparent") {
                foundHighlight =
                    cssColorToHex(inlineBackground, null);
                break;
            }
            highlightElement =
                highlightElement.parentElement;
        }
        setActiveHighlightColor(foundHighlight);
        setHighlightColor(foundHighlight);
    }
    function saveEditorSelection() {
        const selection = window.getSelection();
        if (!selection ||
            selection.rangeCount === 0 ||
            !editorRef.current) {
            return;
        }
        const range = selection.getRangeAt(0);
        // Only save selections that actually belong to Raw Notes
        if (editorRef.current.contains(range.commonAncestorContainer)) {
            savedSelectionRef.current =
                range.cloneRange();
        }
    }
    function restoreEditorSelection() {
        if (!savedSelectionRef.current) {
            return false;
        }
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(savedSelectionRef.current);
        return true;
    }
    function applyEditorColor(command, color) {
        editorRef.current?.focus();
        restoreEditorSelection();
        /*
          foreColor  = text colour
          hiliteColor = background/highlight colour
        */
        const applied = document.execCommand(command, false, color);
        /*
          Fallback for highlight colour if hiliteColor
          isn't accepted by the browser.
        */
        if (command === "hiliteColor" &&
            !applied) {
            document.execCommand("backColor", false, color);
        }
        updateRawNotes();
        updateFormattingState();
        saveEditorSelection();
    }
    function applyHighlightColor(color) {
        editorRef.current?.focus();
        restoreEditorSelection();
        // =====================================================
        // CHECK FOR GRAPH-LINKED TEXT
        // =====================================================
        const linkedSpans = getGraphLinksInSelection();
        if (linkedSpans.length > 0) {
            /*
              IMPORTANT:
      
              Do NOT use execCommand here.
      
              That would create nested/split formatting spans
              inside graph-linked text.
            */
            const processedNodeIds = new Set();
            linkedSpans.forEach((span) => {
                const nodeId = span.dataset.graphNodeId;
                if (!nodeId) {
                    return;
                }
                /*
                  If multiple Raw Notes references point to
                  the same graph node, only process that node
                  once.
                */
                if (processedNodeIds.has(nodeId)) {
                    return;
                }
                processedNodeIds.add(nodeId);
                /*
                  Use the SAME function as the right-click
                  Graph Link colour picker.
        
                  This guarantees both interfaces behave
                  identically.
                */
                handleGraphLinkColorChange(nodeId, span.dataset.graphLinkId, color);
            });
            setHighlightColor(color);
            setActiveHighlightColor(color);
            /*
              Keep the graph link structurally intact.
            */
            saveEditorSelection();
            return;
        }
        // =====================================================
        // NORMAL TEXT HIGHLIGHT
        // =====================================================
        const applied = document.execCommand("hiliteColor", false, color);
        if (!applied) {
            document.execCommand("backColor", false, color);
        }
        setHighlightColor(color);
        setActiveHighlightColor(color);
        updateRawNotes();
        updateFormattingState();
        saveEditorSelection();
    }
    function removeManualHighlight() {
        editorRef.current?.focus();
        restoreEditorSelection();
        const selection = window.getSelection();
        if (!selection ||
            selection.rangeCount === 0) {
            return;
        }
        const range = selection.getRangeAt(0);
        /*
          Nothing selected.
    
          We don't want the eraser to change the
          formatting mode for future typing.
        */
        if (range.collapsed) {
            return;
        }
        // =====================================================
        // PROTECT GRAPH-LINKED TEXT
        // =====================================================
        const linkedSpans = getGraphLinksInSelection();
        if (linkedSpans.length > 0) {
            console.log("Graph-linked highlights cannot be removed with the toolbar.");
            /*
              Graph-linked highlighting is structural.
      
              To remove it, the user must:
              Right click → Remove graph link.
            */
            return;
        }
        // =====================================================
        // REMOVE NORMAL HIGHLIGHT
        // =====================================================
        /*
          Different browsers may use either command,
          so try hiliteColor first and backColor second.
        */
        const removed = document.execCommand("hiliteColor", false, "transparent");
        if (!removed) {
            document.execCommand("backColor", false, "transparent");
        }
        setActiveHighlightColor(null);
        updateRawNotes();
        updateFormattingState();
        saveEditorSelection();
    }
    function toggleUnderlineFormatting() {
        editorRef.current?.focus();
        const block = getCurrentEditorBlock();
        if (!block) {
            return;
        }
        const styleKey = getTextStyleKeyForBlock(block);
        const presetDecoration = textStyles[styleKey]?.textDecorationLine || "none";
        const presetHasUnderline = presetDecoration.includes("underline");
        /*
          Underline supplied by a saved paragraph style
          is painted by the block itself.
    
          execCommand cannot reliably cancel that, so
          create a block-level override instead.
        */
        if (presetHasUnderline) {
            const currentlyDisabled = block.style
                .getPropertyValue("text-decoration-line") === "none";
            if (currentlyDisabled) {
                /*
                  Removing the override allows the saved
                  style underline to show again.
                */
                block.style.removeProperty("text-decoration-line");
            }
            else {
                /*
                  Override this individual heading without
                  modifying the saved style.
                */
                block.style.setProperty("text-decoration-line", "none");
            }
        }
        else {
            /*
              No saved underline exists, so normal
              character-level underline behavior is fine.
            */
            document.execCommand("underline", false, null);
        }
        updateRawNotes();
        updateFormattingState();
    }
    function applyAlignment(alignment) {
        editorRef.current?.focus();
        restoreEditorSelection();
        const commandMap = {
            left: "justifyLeft",
            center: "justifyCenter",
            right: "justifyRight",
            justify: "justifyFull",
        };
        const command = commandMap[alignment];
        if (!command) {
            return;
        }
        document.execCommand(command, false, null);
        /*
          Update immediately rather than waiting
          for another cursor event.
        */
        setActiveAlignment(alignment);
        updateRawNotes();
        saveEditorSelection();
        /*
          Re-read all toolbar formatting after
          the browser has applied the command.
        */
        requestAnimationFrame(() => {
            updateFormattingState();
        });
    }
    function applyIndent(direction) {
        editorRef.current?.focus();
        restoreEditorSelection();
        const command = direction === "increase"
            ? "indent"
            : "outdent";
        document.execCommand(command, false, null);
        updateRawNotes();
        updateFormattingState();
        saveEditorSelection();
    }
    function updateAlignmentState() {
        const selection = window.getSelection();
        if (!selection ||
            selection.rangeCount === 0 ||
            !editorRef.current) {
            return;
        }
        let currentNode = selection.anchorNode;
        if (!currentNode) {
            return;
        }
        let currentElement = currentNode.nodeType === Node.TEXT_NODE
            ? currentNode.parentElement
            : currentNode;
        if (!currentElement ||
            !editorRef.current.contains(currentElement)) {
            return;
        }
        /*
          Find the paragraph/block that actually
          owns the alignment.
        */
        const blockElement = currentElement.closest("p, div, h1, h2, h3, h4, h5, h6, li") || currentElement;
        const alignment = window
            .getComputedStyle(blockElement)
            .textAlign;
        switch (alignment) {
            case "center":
                setActiveAlignment("center");
                break;
            case "right":
                setActiveAlignment("right");
                break;
            case "justify":
                setActiveAlignment("justify");
                break;
            default:
                setActiveAlignment("left");
                break;
        }
    }
    function getCurrentGraphNodes() {
        /*
          Ask GraphPanel for the LIVE Cytoscape graph.
    
          This includes unsaved frontend changes such as:
          - newly added nodes
          - deleted nodes
          - renamed/edited node data
          - manually generated nodes
    
          We deliberately do not use GraphPanel's original
          graphData state here because Cytoscape may have been
          modified since that state was created.
        */
        const currentGraph = graphPanelRef.current
            ?.getGraphData();
        if (!currentGraph?.nodes) {
            return [];
        }
        return currentGraph.nodes
            .map((node) => {
            const data = node.data ?? node;
            return {
                id: String(data.id),
                label: data.label ||
                    "Untitled Node",
                /*
                  Keep these available because they may
                  be useful later in the menu.
                */
                color: data.color ??
                    null,
                shape: data.shape ??
                    null,
                linkColor: data.linkColor ??
                    null,
            };
        });
    }
    function toggleGraphNodeMenu() {
        setLinkHighlightPickerOpen(false);
        if (graphNodeMenuOpen) {
            setGraphNodeMenuOpen(false);
            setGraphNodeSearch("");
            return;
        }
        const currentNodes = getCurrentGraphNodes();
        setGraphNodeOptions(currentNodes);
        setGraphNodeSearch("");
        setGraphNodeMenuOpen(true);
    }
    function handleLinkSelectedTextToExistingNode(node) {
        const range = selectedRangeRef.current;
        if (!range || !node?.id) {
            console.warn("No selected text range or graph node available.");
            return;
        }
        /*
          Reuse the node's existing graph-link colour
          when possible.
    
          If this node has never been linked from Raw Notes
          before, give it the next available link colour.
        */
        const nodeId = String(node.id);
        const { color: linkColor, paletteSlot, } = getNextGraphLinkStyle();
        /*
          If this was the first Raw Notes link to this node,
          tell GraphPanel about its new intrinsic link colour.
        */
        if (!node.linkColor) {
            graphPanelRef.current
                ?.setLinkedNodeColor(node.id, linkColor);
        }
        /*
          Wrap the currently selected Raw Notes text
          and point it at the EXISTING graph node.
        */
        createGraphLinkedText(range, nodeId, linkColor, paletteSlot);
        console.log("Linked selected Raw Notes text to existing node:", {
            nodeId: node.id,
            label: node.label,
            color: linkColor,
        });
        selectedRangeRef.current = null;
        setGraphNodeMenuOpen(false);
        setContextMenu(null);
    }
    function handleChangeLinkedNode(node) {
        if (!editorRef.current ||
            !contextMenu ||
            contextMenu.type !== "linked" ||
            !node?.id) {
            return;
        }
        const currentNodeId = String(contextMenu.nodeId);
        const newNodeId = String(node.id);
        if (currentNodeId === newNodeId) {
            return;
        }
        const linkedSpan = Array.from(editorRef.current.querySelectorAll(".graph-linked-text")).find((span) => span.dataset.graphLinkId ===
            String(contextMenu.linkId));
        if (!linkedSpan) {
            console.warn("Unable to find linked Raw Notes text.");
            return;
        }
        /*
          IMPORTANT:
          Keep the existing colour.
    
          Changing the destination node should NOT
          change the appearance of the text link.
        */
        const linkColor = linkedSpan.dataset.graphLinkColor ||
            contextMenu.color ||
            "#f2c94c";
        /*
          Only change where the link points.
        */
        linkedSpan.dataset.graphNodeId =
            newNodeId;
        /*
          Preserve the existing colour explicitly.
        */
        linkedSpan.dataset.graphLinkColor =
            linkColor;
        linkedSpan.style.setProperty("--graph-link-color", linkColor);
        linkedSpan.style.backgroundColor =
            hexToRgba(linkColor, 0.38);
        /*
          Update the open menu so the purple
          selected-node outline moves immediately.
        */
        setContextMenu((current) => {
            if (!current ||
                current.type !== "linked") {
                return current;
            }
            return {
                ...current,
                nodeId: newNodeId,
                color: linkColor,
            };
        });
        updateRawNotes();
        console.log("Changed linked graph node:", {
            from: currentNodeId,
            to: newNodeId,
            label: node.label,
            preservedColor: linkColor,
        });
    }
    function getNextGraphLinkStyle() {
        const palette = getGraphLinkPalette();
        const paletteSlot = graphLinkColourIndexRef.current %
            palette.length;
        const color = palette[paletteSlot];
        graphLinkColourIndexRef.current += 1;
        return {
            color,
            paletteSlot,
        };
    }
    function refreshAutomaticGraphLinkColors() {
        if (!editorRef.current) {
            return;
        }
        const palette = getGraphLinkPalette();
        if (!palette.length ||
            palette.some((colour) => !colour)) {
            return;
        }
        const linkedSpans = Array.from(editorRef.current
            .querySelectorAll(".graph-linked-text"));
        linkedSpans.forEach((span) => {
            /*
              -------------------------------------------------------
              MIGRATE OLDER GRAPH LINKS
              -------------------------------------------------------
    
              Older links do not yet have:
    
              data-graph-link-palette-slot
              data-graph-link-custom
    
              Try to recognise colours that came from our automatic
              palettes. Unknown colours are treated as custom so we
              never unexpectedly overwrite something the user chose.
            */
            if (span.dataset.graphLinkCustom ===
                undefined ||
                span.dataset
                    .graphLinkPaletteSlot ===
                    undefined) {
                const inferredSlot = inferGraphLinkPaletteSlot(span.dataset
                    .graphLinkColor);
                if (inferredSlot === null) {
                    span.dataset.graphLinkCustom =
                        "true";
                    return;
                }
                span.dataset
                    .graphLinkPaletteSlot =
                    String(inferredSlot);
                span.dataset.graphLinkCustom =
                    "false";
            }
            /*
              Manual colours are intentionally
              excluded from automatic remapping.
            */
            if (span.dataset.graphLinkCustom ===
                "true") {
                return;
            }
            const paletteSlot = Number.parseInt(span.dataset
                .graphLinkPaletteSlot, 10);
            if (!Number.isInteger(paletteSlot) ||
                paletteSlot < 0 ||
                paletteSlot >=
                    palette.length) {
                return;
            }
            const newColor = palette[paletteSlot];
            /*
              Update metadata used by context menus,
              graph hover behaviour and saving.
            */
            span.dataset.graphLinkColor =
                newColor;
            /*
              Update the visible Raw Notes highlight.
            */
            span.style.setProperty("--graph-link-color", newColor);
            /*
              Your current graph-link colour handler also
              keeps this concrete fallback background,
              so update that at the same time.
            */
            span.style.backgroundColor =
                hexToRgba(newColor, 0.38);
        });
        /*
          If the Graph Link context menu is currently open,
          update its little colour indicator as well.
        */
        setContextMenu((current) => {
            if (!current ||
                current.type !==
                    "linked" ||
                !current.linkId) {
                return current;
            }
            const currentSpan = linkedSpans.find((span) => span.dataset
                .graphLinkId ===
                String(current.linkId));
            if (!currentSpan) {
                return current;
            }
            return {
                ...current,
                color: currentSpan.dataset
                    .graphLinkColor ||
                    current.color,
            };
        });
        /*
          Preserve the new palette metadata and colours
          in rawNotesHtml for saving.
        */
        updateRawNotes();
    }
    function getGraphLinksInSelection() {
        if (!editorRef.current ||
            !savedSelectionRef.current) {
            return [];
        }
        const range = savedSelectionRef.current;
        const linkedSpans = Array.from(editorRef.current.querySelectorAll(".graph-linked-text"));
        const matchedLinks = linkedSpans.filter((span) => {
            try {
                /*
                  range.intersectsNode() catches:
                  - full selection of linked text
                  - partial selection of linked text
                  - selection crossing linked text
                */
                return range.intersectsNode(span);
            }
            catch {
                return false;
            }
        });
        /*
          A collapsed caret doesn't always behave quite
          how we want with intersectsNode(), so explicitly
          check what element the caret currently sits inside.
        */
        if (range.collapsed &&
            range.startContainer) {
            const startElement = range.startContainer.nodeType === Node.TEXT_NODE
                ? range.startContainer.parentElement
                : range.startContainer;
            const linkedParent = startElement?.closest?.(".graph-linked-text");
            if (linkedParent &&
                editorRef.current.contains(linkedParent) &&
                !matchedLinks.includes(linkedParent)) {
                matchedLinks.push(linkedParent);
            }
        }
        return matchedLinks;
    }
    function createGraphLinkedText(range, nodeId, color, paletteSlot = null) {
        if (!range) {
            return;
        }
        const linkId = typeof crypto.randomUUID === "function"
            ? `link-${crypto.randomUUID()}`
            : `link-${Date.now()}`;
        const span = document.createElement("span");
        span.className =
            "graph-linked-text";
        span.dataset.graphNodeId =
            nodeId;
        span.dataset.graphLinkId =
            linkId;
        span.dataset.graphLinkColor =
            color;
        /*
        Automatic graph links remember their palette position.
    
        Example:
    
        slot 0
          Standard      → cyan
          Deuteranopia  → blue
          Protanopia    → cyan
          Tritanopia    → green
    
        The slot stays the same while the actual colour changes.
        */
        if (Number.isInteger(paletteSlot)) {
            span.dataset.graphLinkPaletteSlot =
                String(paletteSlot);
            span.dataset.graphLinkCustom =
                "false";
        }
        else {
            span.dataset.graphLinkCustom =
                "true";
        }
        span.style.setProperty("--graph-link-color", color);
        /*
          Preserve formatting that already exists
          inside the selection.
        */
        const contents = range.extractContents();
        span.appendChild(contents);
        range.insertNode(span);
        /*
          Collapse selection after newly linked text.
        */
        const selection = window.getSelection();
        selection.removeAllRanges();
        updateRawNotes();
        console.log("Created Raw Notes graph link:", {
            nodeId,
            linkId,
            color,
        });
    }
    function removeGraphTextLink(linkId) {
        if (!editorRef.current ||
            !linkId) {
            return;
        }
        const linkedSpan = Array.from(editorRef.current.querySelectorAll(".graph-linked-text")).find((span) => span.dataset.graphLinkId ===
            String(linkId));
        if (!linkedSpan) {
            console.warn("Unable to find graph link to remove:", linkId);
            return;
        }
        const nodeId = linkedSpan.dataset.graphNodeId;
        const linkColor = linkedSpan.dataset.graphLinkColor;
        /*
          Make sure GraphPanel isn't temporarily
          showing a hover state for this text link.
        */
        if (nodeId) {
            graphPanelRef.current
                ?.setLinkedNodeHover(nodeId, linkColor, false);
        }
        /*
          UNWRAP the graph-linked span.
    
          We do NOT delete its contents.
    
          Example:
    
            <span class="graph-linked-text">
              application
            </span>
    
          becomes simply:
    
            application
    
          Any formatting nested inside the span is
          preserved too.
        */
        const parent = linkedSpan.parentNode;
        if (!parent) {
            return;
        }
        while (linkedSpan.firstChild) {
            parent.insertBefore(linkedSpan.firstChild, linkedSpan);
        }
        linkedSpan.remove();
        /*
          Merge adjacent text nodes that may have
          been created by removing the wrapper.
        */
        parent.normalize();
        /*
          Store the now-unlinked rich HTML.
        */
        updateRawNotes();
        /*
          Close both context menus.
        */
        setGraphNodeMenuOpen(false);
        setContextMenu(null);
        console.log("Removed Raw Notes graph link:", {
            linkId,
            nodeId,
        });
    }
    function handleAddSelectedTextToGraph() {
        const textToAdd = contextMenu?.text;
        const range = selectedRangeRef.current;
        if (!textToAdd ||
            !range) {
            console.warn("No selected text/range available.");
            return;
        }
        const { color: linkColor, paletteSlot, } = getNextGraphLinkStyle();
        /*
          Ask GraphPanel to create the node.
    
          IMPORTANT:
          createLinkedTextNode must RETURN its node ID.
        */
        const nodeId = graphPanelRef.current
            ?.createLinkedTextNode(textToAdd, linkColor);
        console.log("Created graph node:", nodeId);
        if (!nodeId) {
            console.warn("GraphPanel did not return a node ID.");
            return;
        }
        /*
          Wrap the selected Raw Notes text and
          embed that node ID into it.
        */
        createGraphLinkedText(range, nodeId, linkColor, paletteSlot);
        selectedRangeRef.current =
            null;
        setContextMenu(null);
    }
    function handleGraphLinkColorChange(nodeId, linkId, color) {
        if (!editorRef.current) {
            return;
        }
        console.log("Changing graph text link colour:", {
            nodeId,
            linkId,
            color,
        });
        /*
          Find this exact Raw Notes graph link.
    
          Colour now belongs to the individual text link,
          rather than every piece of text pointing at the
          same graph node.
        */
        const linkedSpan = Array.from(editorRef.current.querySelectorAll(".graph-linked-text")).find((span) => span.dataset.graphLinkId ===
            String(linkId));
        if (!linkedSpan) {
            console.warn("Unable to find graph-linked text:", linkId);
            return;
        }
        /*
          The user has manually chosen a link colour.
    
          Mark this graph link as custom so future
          light/dark or colour-accessibility changes
          do NOT automatically replace it.
        */
        linkedSpan.dataset.graphLinkCustom =
            "true";
        linkedSpan.dataset.graphLinkColor =
            color;
        linkedSpan.style.setProperty("--graph-link-color", color);
        linkedSpan.style.backgroundColor =
            hexToRgba(color, 0.38);
        /*
          Keep the open Graph Link context menu
          synchronised with the new colour.
        */
        setContextMenu((current) => {
            if (!current ||
                current.linkId !== linkId) {
                return current;
            }
            return {
                ...current,
                color,
            };
        });
        updateRawNotes();
    }
    function getLinkedTextReferences(nodeId) {
        if (!editorRef.current) {
            return [];
        }
        return Array.from(editorRef.current.querySelectorAll(".graph-linked-text")).filter((span) => span.dataset.graphNodeId ===
            String(nodeId));
    }
    function clearLinkedTextNavigatorFocus() {
        if (!editorRef.current) {
            return;
        }
        editorRef.current
            .querySelectorAll(".graph-linked-text-navigation-current")
            .forEach((span) => {
            span.classList.remove("graph-linked-text-navigation-current");
        });
    }
    function focusLinkedTextReference(nodeId, nodeLabel, requestedIndex) {
        const editor = editorRef.current;
        if (!editor) {
            return;
        }
        const references = getLinkedTextReferences(nodeId);
        clearLinkedTextNavigatorFocus();
        // Node exists, but has no Raw Notes references.
        if (references.length === 0) {
            setLinkedTextNavigator({
                nodeId: String(nodeId),
                nodeLabel: nodeLabel || "Selected node",
                currentIndex: 0,
                total: 0,
            });
            return;
        }
        /*
          Wrap navigation around:
          previous from 0 -> final result
          next from final -> 0
        */
        const normalizedIndex = (requestedIndex %
            references.length +
            references.length) %
            references.length;
        const reference = references[normalizedIndex];
        reference.classList.add("graph-linked-text-navigation-current");
        setLinkedTextNavigator({
            nodeId: String(nodeId),
            nodeLabel: nodeLabel || "Selected node",
            currentIndex: normalizedIndex,
            total: references.length,
        });
        /*
          Scroll only the Raw Notes content area.
    
          We calculate the reference position relative
          to the current editor scroll position so that
          even references far below the visible area
          can be brought into view.
        */
        const editorRect = editor.getBoundingClientRect();
        const referenceRect = reference.getBoundingClientRect();
        const targetScrollTop = editor.scrollTop +
            (referenceRect.top -
                editorRect.top) -
            (editor.clientHeight / 2) +
            (referenceRect.height / 2);
        editor.scrollTo({
            top: Math.max(0, targetScrollTop),
            behavior: "smooth",
        });
    }
    function openLinkedTextNavigator(nodeId, nodeLabel) {
        focusLinkedTextReference(nodeId, nodeLabel, 0);
    }
    function moveLinkedTextNavigator(direction) {
        if (!linkedTextNavigator) {
            return;
        }
        const references = getLinkedTextReferences(linkedTextNavigator.nodeId);
        /*
          Re-read references every time rather than
          trusting the old total.
    
          This means navigation still works if the
          user edits/removes linked text while the
          navigator is open.
        */
        if (references.length === 0) {
            focusLinkedTextReference(linkedTextNavigator.nodeId, linkedTextNavigator.nodeLabel, 0);
            return;
        }
        const nextIndex = linkedTextNavigator.currentIndex +
            direction;
        focusLinkedTextReference(linkedTextNavigator.nodeId, linkedTextNavigator.nodeLabel, nextIndex);
    }
    function closeLinkedTextNavigator() {
        clearLinkedTextNavigatorFocus();
        setLinkedTextNavigator(null);
    }
    // =========================================================
    // Load Raw Notes content
    // =========================================================
    useEffect(() => {
        if (!editorRef.current) {
            return;
        }
        /*
          Initialise editor content only when
          switching to a different note.
    
          Later, if backend stores rich HTML,
          prefer note.notes_section_html here.
        */
        editorRef.current.innerHTML =
            note.notes_section_html ||
                note.content ||
                "";
        /*
          The DOM content has just been restored.
    
          On the next frame, migrate older links and apply
          the user's currently active accessibility palette.
        */
        requestAnimationFrame(() => {
            refreshAutomaticGraphLinkColors();
        });
    }, [note.id]);
    // =========================================================
    // Keeps accessibility colours updated
    // =========================================================
    useEffect(() => {
        const root = document.documentElement;
        const observer = new MutationObserver((mutations) => {
            const colourModeChanged = mutations.some((mutation) => mutation.attributeName ===
                "data-theme" ||
                mutation.attributeName ===
                    "data-color-vision");
            if (!colourModeChanged) {
                return;
            }
            /*
              Wait one frame so the new CSS variables
              have taken effect before reading them.
            */
            requestAnimationFrame(() => {
                refreshAutomaticGraphLinkColors();
            });
        });
        observer.observe(root, {
            attributes: true,
            attributeFilter: [
                "data-theme",
                "data-color-vision",
            ],
        });
        return () => {
            observer.disconnect();
        };
    }, []);
    // =========================================================
    // Paragraph formatting popover
    // =========================================================
    useEffect(() => {
        function handleParagraphMenuOutside(event) {
            if (paragraphMenuRef.current &&
                !paragraphMenuRef.current.contains(event.target)) {
                setParagraphMenuOpen(false);
            }
        }
        function handleParagraphMenuEscape(event) {
            if (event.key === "Escape") {
                setParagraphMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleParagraphMenuOutside);
        document.addEventListener("keydown", handleParagraphMenuEscape);
        return () => {
            document.removeEventListener("mousedown", handleParagraphMenuOutside);
            document.removeEventListener("keydown", handleParagraphMenuEscape);
        };
    }, []);
    useImperativeHandle(ref, () => ({
        async saveEverything() {
            if (!note?.id) {
                throw new Error("No note is selected.");
            }
            const graph = graphPanelRef.current
                ?.getGraphData();
            const saved = await updateNote(note.id, {
                title,
                notes_section: rawNotes,
                notes_section_html: rawNotesHtml,
                summary_section: summary,
                // Omitting graph_json leaves an existing saved
                // graph untouched. Sending null would clear it.
                ...(graph
                    ? {
                        graph_json: graph,
                    }
                    : {}),
            });
            onNoteSaved?.(saved);
            return saved;
        },
    }));
    return (<div className={`note-workspace ${focusedPanel
            ? `workspace-focus-mode focus-${focusedPanel}`
            : ""}`} style={{
            ...(focusedPanelHeight
                ? {
                    "--focused-panel-height": `${focusedPanelHeight}px`,
                }
                : {}),
        }} onClick={() => {
            setContextMenu(null);
            setGraphNodeMenuOpen(false);
            setLinkHighlightPickerOpen(false);
        }}>

    {/* << frontend dev >> */}
    {/* Note title + workspace layout selector */}

      <div className="note-title-panel">
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="note-title"/>

        <div className="workspace-layout-dropdown" ref={layoutDropdownRef}>
          <button type="button" className={`workspace-layout-trigger ${layoutDropdownOpen
            ? "workspace-layout-trigger-open"
            : ""}`} aria-haspopup="listbox" aria-expanded={layoutDropdownOpen} aria-label={`Workspace layout: ${workspaceLayoutDisplayLabel}`} onClick={(event) => {
            event.stopPropagation();
            setLayoutDropdownOpen((current) => !current);
        }}>
            <WorkspaceLayoutTriggerIcon size={17} strokeWidth={1.8} className="workspace-layout-trigger-icon" aria-hidden="true"/>

            <span className="workspace-layout-trigger-label">
              {workspaceLayoutDisplayLabel}
            </span>

            <ChevronDown size={15} strokeWidth={1.8} className={`workspace-layout-chevron ${layoutDropdownOpen
            ? "workspace-layout-chevron-open"
            : ""}`} aria-hidden="true"/>
          </button>

          {layoutDropdownOpen && (<div className="workspace-layout-menu" role="listbox" aria-label="Workspace layout" onClick={(event) => event.stopPropagation()}>
              {(workspaceLayoutDisplayValue === "custom" ||
                workspaceLayoutDisplayValue === "focused") && (<>
                  <div className="workspace-layout-option workspace-layout-option-selected workspace-layout-status" role="option" aria-selected="true">
                    <span className="workspace-layout-option-main">
                      {workspaceLayoutDisplayValue === "focused" ? (<Maximize2 size={16} strokeWidth={1.8} className="workspace-layout-option-icon" aria-hidden="true"/>) : (<LayoutBalancedIcon size={16} strokeWidth={1.8} className="workspace-layout-option-icon" aria-hidden="true"/>)}

                      <span>
                        {workspaceLayoutDisplayLabel}
                      </span>
                    </span>

                    <Check size={14} strokeWidth={2} aria-hidden="true"/>
                  </div>

                  <div className="workspace-layout-menu-divider" aria-hidden="true"/>
                </>)}

              {WORKSPACE_LAYOUT_PRESETS.map((preset) => {
                const isSelected = workspaceLayoutDisplayValue ===
                    preset.value;
                const PresetIcon = preset.Icon;
                return (<button key={preset.value} type="button" role="option" aria-selected={isSelected} className={`workspace-layout-option ${isSelected
                        ? "workspace-layout-option-selected"
                        : ""}`} onClick={() => applyWorkspaceLayout(preset)}>
                      <span className="workspace-layout-option-main">
                        <PresetIcon size={16} strokeWidth={1.8} className="workspace-layout-option-icon" aria-hidden="true"/>

                        <span>
                          {preset.label}
                        </span>
                      </span>

                      {isSelected && (<Check size={14} strokeWidth={2} aria-hidden="true"/>)}
                    </button>);
            })}
            </div>)}
        </div>
      </div>

      <div ref={topPanelsShellRef} className={`notes-row-resizable-shell ${isResizingTopPanels
            ? "notes-row-resizing"
            : ""}`} style={{
            "--top-panels-height": `${topPanelsHeight}px`,
        }}>
      <div ref={notesLayoutRef} className={`notes-layout ${isResizingNotesGraph
            ? "notes-layout-resizing"
            : ""}`} style={{
            "--notes-panel-fr": `${notesGraphSplit}fr`,
            "--graph-panel-fr": `${100 - notesGraphSplit}fr`,
        }}>
        <section className="raw-notes">
          
          <div className="raw-notes-heading">

            <div className="raw-notes-heading-title">
              <h2>Raw Notes</h2>

              <Notebook size={21} strokeWidth={2} aria-hidden="true"/>
            </div>

            <div className="raw-notes-heading-actions">
              <button type="button" className="panel-focus-button transcription-launch-button tooltip-align-right" onClick={openTranscriptionModal} aria-label="Open transcription review" aria-pressed={transcriptionModalOpen} data-tooltip="Transcribe with microphone">
                <Mic size={18} strokeWidth={1.9}/>
              </button>

              <button type="button" className="panel-focus-button tooltip-align-right" onClick={(event) => {
            event.stopPropagation();
            togglePanelFocus("notes");
        }} aria-label={focusedPanel === "notes"
            ? "Exit Raw Notes focus mode"
            : "Focus Raw Notes"} aria-pressed={focusedPanel === "notes"} data-tooltip={focusedPanel === "notes"
            ? "Restore layout"
            : "Focus Raw Notes"}>
                {focusedPanel === "notes" ? (<Minimize2 size={18} strokeWidth={1.9}/>) : (<Maximize2 size={18} strokeWidth={1.9}/>)}
              </button>
            </div>

          </div>
          
          <div className="raw-notes-editor">
            
            <div className="raw-notes-toolbar" role="toolbar" aria-label="Text formatting">
              {/* Text style */}

              <div className="text-style-dropdown" ref={textStyleDropdownRef}>
                <button type="button" className={`text-style-trigger ${textStyleDropdownOpen
            ? "text-style-trigger-open"
            : ""}`} aria-haspopup="listbox" aria-expanded={textStyleDropdownOpen} aria-label={`Text style: ${activeTextStyleLabel}`} onMouseDown={(event) => {
            /*
              Prevent the toolbar from stealing the
              current editor selection.
            */
            event.preventDefault();
        }} onClick={(event) => {
            event.stopPropagation();
            setLayoutDropdownOpen(false);
            setFontFamilyDropdownOpen(false);
            setTextStyleDropdownOpen((current) => !current);
        }}>
                  <Type size={15} strokeWidth={1.8} className="text-style-trigger-icon" aria-hidden="true"/>

                  <span className="text-style-trigger-label">
                    {activeTextStyleLabel}
                  </span>

                  <ChevronDown size={14} strokeWidth={1.8} className={`text-style-chevron ${textStyleDropdownOpen
            ? "text-style-chevron-open"
            : ""}`} aria-hidden="true"/>
                </button>

                {textStyleDropdownOpen && (<div className="text-style-menu" role="listbox" aria-label="Text style" onClick={(event) => event.stopPropagation()}>
                    {TEXT_STYLE_OPTIONS.map((option) => {
                const isSelected = activeTextStyleValue ===
                    option.value;
                return (<div key={option.value} className="text-style-option-row">
                            <button type="button" role="option" aria-selected={isSelected} className={`text-style-option ${isSelected
                        ? "text-style-option-selected"
                        : ""}`} onMouseDown={(event) => {
                        event.preventDefault();
                    }} onClick={() => applyTextStyle(option.value)}>
                              <span className="text-style-option-preview" style={getTextStylePreview(option.value)}>
                                {option.label}
                              </span>

                              <span className="text-style-option-icons">
                                {isSelected && (<Check size={14} strokeWidth={2} aria-hidden="true"/>)}

                                <ChevronRight size={14} strokeWidth={1.8} aria-hidden="true"/>
                              </span>
                            </button>

                            <div className="text-style-action-menu" role="menu" aria-label={`${option.label} actions`}>
                              <div className="text-style-action-menu-title">
                                {option.label}
                              </div>

                              <button type="button" role="menuitem" onMouseDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                    }} onClick={(event) => {
                        event.stopPropagation();
                        updateTextStyleToMatch(option.value);
                    }}>
                                Update to match
                              </button>

                              <button type="button" role="menuitem" onMouseDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                    }} onClick={(event) => {
                        event.stopPropagation();
                        resetTextStyle(option.value);
                    }}>
                                Reset style
                              </button>
                            </div>
                          </div>);
            })}

                  </div>)}
              </div>

              <span className="toolbar-divider"/>
              
              {/* Font type */}

                <div className="text-style-dropdown font-family-dropdown" ref={fontFamilyDropdownRef}>
                  <button type="button" className={`text-style-trigger font-family-trigger ${fontFamilyDropdownOpen
            ? "text-style-trigger-open"
            : ""}`} aria-haspopup="listbox" aria-expanded={fontFamilyDropdownOpen} aria-label={`Font: ${activeFontFamilyLabel}`} onMouseDown={(event) => {
            event.preventDefault();
        }} onClick={(event) => {
            event.stopPropagation();
            setLayoutDropdownOpen(false);
            setTextStyleDropdownOpen(false);
            setFontFamilyDropdownOpen((current) => !current);
        }}>
                    <span className="text-style-trigger-label">
                      {activeFontFamilyLabel}
                    </span>

                    <ChevronDown size={14} strokeWidth={1.8} className={`text-style-chevron ${fontFamilyDropdownOpen
            ? "text-style-chevron-open"
            : ""}`} aria-hidden="true"/>
                  </button>

                  {fontFamilyDropdownOpen && (<div className="text-style-menu font-family-menu" role="listbox" aria-label="Font family" onClick={(event) => event.stopPropagation()}>
                      {FONT_FAMILY_OPTIONS.map((font) => (<button key={font.value} type="button" role="option" aria-selected={activeFontFamily === font.value} className={`text-style-option ${activeFontFamily === font.value
                    ? "text-style-option-selected"
                    : ""}`} onMouseDown={(event) => {
                    event.preventDefault();
                }} onClick={() => applyFontFamily(font.value)}>
                          <span className="font-family-option-label" style={{
                    fontFamily: font.value,
                }}>
                            {font.label}
                          </span>

                          {activeFontFamily === font.value && (<Check size={14} strokeWidth={2}/>)}
                        </button>))}
                    </div>)}
                </div>

              <span className="toolbar-divider"/>

              {/* Font size */}

                <div className="font-size-control">
                  <button type="button" className="toolbar-icon-button font-size-button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyFontSize(activeFontSize - 1)} aria-label="Decrease font size" data-tooltip="Decrease font size">
                    −
                  </button>

                  <span className="font-size-value" aria-label={`Font size ${activeFontSize}`}>
                    {activeFontSize}
                  </span>

                  <button type="button" className="toolbar-icon-button font-size-button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyFontSize(activeFontSize + 1)} aria-label="Increase font size" data-tooltip="Increase font size">
                    +
                  </button>
                </div>

              <span className="toolbar-divider"/>
              
              {/* Font formatting */}
              
              <button type="button" className={`toolbar-icon-button ${activeFormats.bold
            ? "toolbar-button-active"
            : ""}`} onMouseDown={(event) => event.preventDefault()} onClick={() => runFormat("bold")} aria-pressed={activeFormats.bold} data-tooltip="Bold" aria-label="Bold">
                <Bold size={18} strokeWidth={2.2}/>
              </button>
              
              <button type="button" className={`toolbar-icon-button ${activeFormats.italic
            ? "toolbar-button-active"
            : ""}`} onMouseDown={(event) => event.preventDefault()} onClick={() => runFormat("italic")} aria-pressed={activeFormats.italic} data-tooltip="Italic" aria-label="Italic">
                <Italic size={18} strokeWidth={2}/>
              </button>
              
              <button type="button" className={`toolbar-icon-button ${activeFormats.underline
            ? "toolbar-button-active"
            : ""}`} onMouseDown={(event) => event.preventDefault()} onClick={toggleUnderlineFormatting} aria-pressed={activeFormats.underline} data-tooltip="Underline" aria-label="Underline">
                <Underline size={18} strokeWidth={2}/>
              </button>
              
              {/* Text Colour */}

              <div className="toolbar-color-wrapper">

                <button ref={textColorButtonRef} type="button" className={`
                    toolbar-icon-button
                    toolbar-color-button
                    ${textColorPickerOpen
            ? "toolbar-button-active"
            : ""}
                  `} onMouseDown={(event) => {
            /*
              Preserve the current Raw Notes
              selection before focus moves to
              the colour picker.
            */
            saveEditorSelection();
            event.preventDefault();
        }} onClick={() => {
            setTextColorPickerOpen((current) => !current);
        }} data-tooltip="Text colour" aria-label="Text colour" aria-expanded={textColorPickerOpen} aria-haspopup="dialog">

                  <FontColorIcon size={18} strokeWidth={1.9}/>

                  <span className="toolbar-color-indicator" style={{
            backgroundColor: activeTextColor,
        }}/>

                </button>


                <TreeNotesColorPicker open={textColorPickerOpen} anchorRef={textColorButtonRef} value={textColor ||
            activeTextColor ||
            "#eef1f7"} onChange={(color) => {
            /*
              Store the selected colour so the
              picker and toolbar remain synced.
            */
            setTextColor(color);
            setActiveTextColor(color);
            /*
              Apply it to the Raw Notes selection.

              applyEditorColor already restores the
              saved editor selection, so interacting
              with the floating picker won't lose
              the selected text.
            */
            applyEditorColor("foreColor", color);
        }} onClose={() => {
            setTextColorPickerOpen(false);
        }}/>

              </div>

              {/* Highlight Colour */}

              <div className="toolbar-color-wrapper">

                <button ref={highlightColorButtonRef} type="button" className={`
                    toolbar-icon-button
                    toolbar-color-button
                    ${highlightColorPickerOpen
            ? "toolbar-button-active"
            : ""}
                  `} onMouseDown={(event) => {
            saveEditorSelection();
            event.preventDefault();
        }} onClick={() => {
            /*
              Check whether the saved Raw Notes selection
              contains graph-linked text.

              Graph-linked text may be recoloured, but its
              highlight cannot be removed because that
              colour is part of the visual graph connection.
            */
            const containsGraphLink = getGraphLinksInSelection()
                .length > 0;
            setHighlightNoneDisabled(containsGraphLink);
            setHighlightColorPickerOpen((current) => !current);
        }} data-tooltip="Highlight colour" aria-label="Highlight colour" aria-expanded={highlightColorPickerOpen} aria-haspopup="dialog">
                  <Highlighter size={18} strokeWidth={1.9}/>

                  <span className="toolbar-color-indicator" style={{
            backgroundColor: activeHighlightColor ||
                "transparent",
        }}/>

                </button>


                <TreeNotesColorPicker open={highlightColorPickerOpen} anchorRef={highlightColorButtonRef} value={highlightColor ||
            activeHighlightColor ||
            "#625DF0"} showNone noneSelected={!activeHighlightColor} noneDisabled={highlightNoneDisabled} onChange={(color) => {
            setHighlightColor(color);
            setActiveHighlightColor(color);
            /*
              applyHighlightColor already handles both:
                normal text -> normal highlight
                graph-linked text -> graph-link recolour
            */
            applyHighlightColor(color);
        }} onNone={() => {
            /*
              removeManualHighlight already contains a
              second safety check preventing linked text
              from losing its structural highlight.
            */
            removeManualHighlight();
            setHighlightColorPickerOpen(false);
        }} onClose={() => {
            setHighlightColorPickerOpen(false);
        }}/>

              </div>

              <span className="toolbar-divider"/>
              
              {/* Paragraph Formatting */}

              <div className="toolbar-popover-wrapper" ref={paragraphMenuRef}>

                <button type="button" className={`toolbar-icon-button ${paragraphMenuOpen
            ? "toolbar-button-active"
            : ""}`} onMouseDown={(event) => {
            /*
              Preserve the editor selection before
              interacting with the toolbar.
            */
            saveEditorSelection();
            event.preventDefault();
        }} onClick={() => {
            setParagraphMenuOpen((current) => {
                const nextOpen = !current;
                /*
                  When opening the popover,
                  restore the editor selection and
                  check the paragraph's current alignment.
                */
                if (nextOpen) {
                    restoreEditorSelection();
                    requestAnimationFrame(() => {
                        updateAlignmentState();
                    });
                }
                return nextOpen;
            });
        }} data-tooltip="Alignment and indent" aria-label="Alignment and indent" aria-expanded={paragraphMenuOpen} aria-haspopup="true">
                  <span className="alignment-toolbar-icon">
                    <ActiveAlignmentIcon size={19} strokeWidth={1.9}/>

                    <ChevronDown className="alignment-toolbar-chevron" size={12} strokeWidth={2}/>
                  </span>
                </button>


                {paragraphMenuOpen && (<div className="paragraph-format-popover" contentEditable={false}>

                    {/* Alignment */}

                    <div className="paragraph-format-row">

                      <button type="button" className={`paragraph-format-button ${activeAlignment === "left"
                ? "paragraph-format-button-active"
                : ""}`} onMouseDown={(event) => event.preventDefault()} onClick={() => applyAlignment("left")} aria-label="Align left" data-tooltip="Align left">
                        <AlignLeft size={18} strokeWidth={1.8}/>
                      </button>


                      <button type="button" className={`paragraph-format-button ${activeAlignment === "center"
                ? "paragraph-format-button-active"
                : ""}`} onMouseDown={(event) => event.preventDefault()} onClick={() => applyAlignment("center")} aria-label="Align centre" data-tooltip="Align centre">
                        <AlignCenter size={18} strokeWidth={1.8}/>
                      </button>


                      <button type="button" className={`paragraph-format-button ${activeAlignment === "right"
                ? "paragraph-format-button-active"
                : ""}`} onMouseDown={(event) => event.preventDefault()} onClick={() => applyAlignment("right")} aria-label="Align right" data-tooltip="Align right">
                        <AlignRight size={18} strokeWidth={1.8}/>
                      </button>


                      <button type="button" className={`paragraph-format-button ${activeAlignment === "justify"
                ? "paragraph-format-button-active"
                : ""}`} onMouseDown={(event) => event.preventDefault()} onClick={() => applyAlignment("justify")} aria-label="Justify" data-tooltip="Justify">
                        <AlignJustify size={18} strokeWidth={1.8}/>
                      </button>

                    </div>


                    <div className="paragraph-popover-divider"/>


                    {/* Indentation */}

                    <div className="paragraph-format-row">

                      <button type="button" className="paragraph-format-button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyIndent("decrease")} aria-label="Decrease indent" data-tooltip="Decrease indent">
                        <IndentDecrease size={18} strokeWidth={1.8}/>
                      </button>


                      <button type="button" className="paragraph-format-button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyIndent("increase")} aria-label="Increase indent" data-tooltip="Increase indent">
                        <IndentIncrease size={18} strokeWidth={1.8}/>
                      </button>

                    </div>

                  </div>)}

              </div>
              
              {/* Lists */}
              
              <button type="button" className={`toolbar-icon-button ${activeFormats.bulletList
            ? "toolbar-button-active"
            : ""}`} onMouseDown={(event) => event.preventDefault()} onClick={() => runFormat("insertUnorderedList")} aria-pressed={activeFormats.bulletList} data-tooltip="Bullet list" aria-label="Bullet list">
                <List size={19} strokeWidth={1.9}/>
              </button>
              
              <button type="button" className={`toolbar-icon-button ${activeFormats.numberedList
            ? "toolbar-button-active"
            : ""}`} onMouseDown={(event) => event.preventDefault()} onClick={() => runFormat("insertOrderedList")} aria-pressed={activeFormats.numberedList} data-tooltip="Numbered list" aria-label="Numbered list">
                <ListOrdered size={19} strokeWidth={1.9}/>
              </button>
              
              
              <span className="toolbar-divider"/>
              
              
              {/* Link */}
              
              <button type="button" className="toolbar-icon-button" onClick={addLink} data-tooltip="Insert link" aria-label="Insert link">
                <Link size={19} strokeWidth={1.9}/>
              </button>
              
            </div>

            <div className="raw-notes-content-shell">

              {linkedTextNavigator && (<div className="linked-text-navigator" role="group" aria-label="Linked text navigation">

                <div className="linked-text-navigator-info">

                  <strong title={linkedTextNavigator.nodeLabel}>
                    {linkedTextNavigator.nodeLabel}
                  </strong>


                  <span aria-live="polite">

                    {linkedTextNavigator.total > 0
                ? `${linkedTextNavigator.currentIndex +
                    1} / ${linkedTextNavigator.total}`
                : "No linked text"}

                  </span>

                </div>


                <div className="linked-text-navigator-actions">

                  <button type="button" disabled={linkedTextNavigator.total <= 1} onMouseDown={(event) => event.preventDefault()} onClick={() => moveLinkedTextNavigator(-1)} data-tooltip="Previous reference" aria-label="Previous linked text">
                    <ChevronUp size={17} strokeWidth={1.9}/>
                  </button>


                  <button type="button" disabled={linkedTextNavigator.total <= 1} onMouseDown={(event) => event.preventDefault()} onClick={() => moveLinkedTextNavigator(1)} data-tooltip="Next reference" aria-label="Next linked text">
                    <ChevronDown size={17} strokeWidth={1.9}/>
                  </button>


                  <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={closeLinkedTextNavigator} data-tooltip="Close" aria-label="Close linked text navigation">
                    <X size={16} strokeWidth={1.9}/>
                  </button>

                </div>

              </div>)}
            
            <div ref={editorRef} className="text-area raw-notes-content" style={textStyleVariables} contentEditable suppressContentEditableWarning onContextMenu={(event) => {
            // =====================================================
            // 1. CHECK IF USER RIGHT-CLICKED LINKED GRAPH TEXT
            // =====================================================
            const targetElement = event.target instanceof Element
                ? event.target
                : event.target?.parentElement;
            const linkedText = targetElement?.closest(".graph-linked-text");
            if (linkedText &&
                editorRef.current?.contains(linkedText)) {
                event.preventDefault();
                /*
                  We do NOT need a text selection here.

                  Everything needed is already stored directly
                  on the graph-linked span.
                */
                selectedRangeRef.current = null;
                setGraphNodeMenuOpen(false);
                setLinkHighlightPickerOpen(false);
                setContextMenu({
                    type: "linked",
                    x: event.clientX,
                    y: event.clientY,
                    text: linkedText.textContent || "",
                    nodeId: linkedText.dataset.graphNodeId,
                    linkId: linkedText.dataset.graphLinkId,
                    color: linkedText.dataset.graphLinkColor ||
                        getDefaultGraphLinkColor(),
                });
                return;
            }
            // =====================================================
            // 2. OTHERWISE CHECK ORDINARY SELECTED TEXT
            // =====================================================
            const selection = window.getSelection();
            const text = selection
                ?.toString()
                .trim() || "";
            if (!text ||
                !selection ||
                selection.rangeCount === 0) {
                /*
                  Nothing special was clicked.

                  Do NOT preventDefault here so the normal
                  browser right-click menu still works.
                */
                setContextMenu(null);
                return;
            }
            // =====================================================
            // 3. NEW TEXT → ADD TO GRAPH MENU
            // =====================================================
            event.preventDefault();
            const range = selection.getRangeAt(0);
            /*
              Make sure the selection actually belongs to
              the Raw Notes editor.
            */
            if (!editorRef.current?.contains(range.commonAncestorContainer)) {
                return;
            }
            selectedRangeRef.current = range.cloneRange();
            setGraphNodeMenuOpen(false);
            setLinkHighlightPickerOpen(false);
            setContextMenu({
                type: "new",
                x: event.clientX,
                y: event.clientY,
                text: text,
            });
        }} onClick={(event) => {
            const linkedText = event.target.closest?.(".graph-linked-text");
            if (!linkedText) {
                return;
            }
            const nodeId = linkedText.dataset.graphNodeId;
            console.log("Clicked linked text:", nodeId);
            graphPanelRef.current
                ?.focusNode(nodeId);
        }} onMouseOver={(event) => {
            const linkedText = event.target.closest?.(".graph-linked-text");
            if (!linkedText) {
                return;
            }
            /*
              Prevent repeated events while moving
              between descendants of the same span.
            */
            if (event.relatedTarget &&
                linkedText.contains(event.relatedTarget)) {
                return;
            }
            graphPanelRef.current
                ?.setLinkedNodeHover(linkedText.dataset.graphNodeId, linkedText.dataset.graphLinkColor, true);
        }} onMouseOut={(event) => {
            const linkedText = event.target.closest?.(".graph-linked-text");
            if (!linkedText) {
                return;
            }
            if (event.relatedTarget &&
                linkedText.contains(event.relatedTarget)) {
                return;
            }
            graphPanelRef.current
                ?.setLinkedNodeHover(linkedText.dataset.graphNodeId, linkedText.dataset.graphLinkColor, false);
        }} onInput={() => {
            updateRawNotes();
            updateFormattingState();
        }} onMouseUp={() => {
            updateFormattingState();
            const selection = window.getSelection();
            const text = selection?.toString().trim() || "";
            setSelectedText(text);
            console.log("Selected text:", text);
        }} onKeyUp={updateFormattingState} onSelect={updateFormattingState} onFocus={updateFormattingState}>

            </div>

            </div>

            {/* UI OVERLAYS MUST LIVE OUTSIDE THE SAVED EDITOR */}
            {contextMenu && (<div className="notes-context-menu" contentEditable={false} style={{
                left: contextMenu.x,
                top: contextMenu.y,
            }} onClick={(event) => event.stopPropagation()}>

                  <div className="notes-context-menu-preview">

                    <span>
                      {contextMenu.type === "linked"
                ? "Graph Link"
                : "Selected Text"}
                    </span>

                    <strong>
                      {contextMenu.text}
                    </strong>

                  </div>


                  <div className="notes-context-menu-divider"/>


                  {contextMenu.type === "new" ? (<>

                      <button type="button" className="notes-context-menu-item" onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                }} onClick={(event) => {
                    event.stopPropagation();
                    handleAddSelectedTextToGraph();
                }}>
                        <span className="notes-context-menu-icon">
                          <span className="graph-create-action-icon">
                            <Squircle size={18} strokeWidth={1.8}/>
                            <Plus className="graph-create-action-plus" size={9} strokeWidth={2.5}/>
                          </span>
                        </span>

                        <span>
                          Create as a new node
                        </span>
                      </button>

                      <div className="notes-context-submenu-anchor">

                        <button type="button" className={`notes-context-menu-item ${graphNodeMenuOpen
                    ? "notes-context-menu-item-active"
                    : ""}`} aria-haspopup="menu" aria-expanded={graphNodeMenuOpen} onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                }} onClick={(event) => {
                    event.stopPropagation();
                    toggleGraphNodeMenu();
                }}>
                          <span className="notes-context-menu-icon">
                            <Link size={17} strokeWidth={1.8}/>
                          </span>

                          <span>
                            Link to existing node
                          </span>

                          <ChevronRight size={15} strokeWidth={1.8} className={`notes-context-submenu-chevron ${graphNodeMenuOpen
                    ? "notes-context-submenu-chevron-open"
                    : ""}`}/>
                        </button>


                        {graphNodeMenuOpen && (<div className="notes-graph-node-menu" contentEditable={false} onMouseDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                    }} onClick={(event) => {
                        event.stopPropagation();
                    }}>

                            <div className="notes-graph-node-menu-heading">
                              Graph Nodes
                            </div>


                            <div className="notes-graph-node-menu-divider"/>

                            {graphNodeOptions.length > 0 && (<div className="graph-property-dropdown-search-wrap notes-graph-node-search-wrap" onMouseDown={(event) => {
                            event.stopPropagation();
                        }} onClick={(event) => {
                            event.stopPropagation();
                        }}>
                                <Search size={13} strokeWidth={1.8} aria-hidden="true"/>

                                <input type="text" className="graph-property-dropdown-search" value={graphNodeSearch} onChange={(event) => {
                            setGraphNodeSearch(event.target.value);
                        }} placeholder="Search graph nodes..." aria-label="Search graph nodes" autoFocus/>
                              </div>)}

                            <div className="notes-graph-node-menu-list">
                              {graphNodeOptions.length > 0 ? (filteredGraphNodeOptions.length > 0 ? (filteredGraphNodeOptions.map((node) => (<button key={node.id} type="button" className="notes-graph-node-menu-item" onMouseDown={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                        }} onClick={(event) => {
                            event.stopPropagation();
                            handleLinkSelectedTextToExistingNode(node);
                        }}>
                                      <span>
                                        {node.label}
                                      </span>
                                    </button>))) : (<div className="notes-graph-node-menu-empty">
                                    No matching graph nodes
                                  </div>)) : (<div className="notes-graph-node-menu-empty">
                                  No graph nodes available
                                </div>)}
                            </div>

                          </div>)}

                      </div>

                    </>) : (<>
                      {/* Linked-text options go here */}

                      <div className="notes-context-color-wrapper">

                        <button ref={linkHighlightButtonRef} type="button" className={`notes-context-menu-item ${linkHighlightPickerOpen
                    ? "notes-context-menu-item-active"
                    : ""}`} aria-haspopup="dialog" aria-expanded={linkHighlightPickerOpen} onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                }} onClick={(event) => {
                    event.stopPropagation();
                    setGraphNodeMenuOpen(false);
                    setLinkHighlightPickerOpen(current => !current);
                }}>

                          <span className="notes-context-highlight-icon">

                            <Highlighter size={17} strokeWidth={1.8}/>

                            <span className="notes-context-color-indicator" style={{
                    backgroundColor: contextMenu.color ||
                        getDefaultGraphLinkColor(),
                }}/>

                          </span>

                          <span>
                            Link highlight
                          </span>

                          <ChevronRight size={15} strokeWidth={1.8} className={`notes-context-submenu-chevron ${linkHighlightPickerOpen
                    ? "notes-context-submenu-chevron-open"
                    : ""}`}/>

                        </button>

                        <TreeNotesColorPicker open={linkHighlightPickerOpen} anchorRef={linkHighlightButtonRef} placement="right-start" value={contextMenu.color ||
                    getDefaultGraphLinkColor()} onChange={(color) => {
                    handleGraphLinkColorChange(contextMenu.nodeId, contextMenu.linkId, color);
                }} onClose={() => {
                    setLinkHighlightPickerOpen(false);
                }} showNone noneDisabled/>

                      </div>

                      <div className="notes-context-submenu-anchor">

                        <button type="button" className={`notes-context-menu-item ${graphNodeMenuOpen
                    ? "notes-context-menu-item-active"
                    : ""}`} aria-haspopup="menu" aria-expanded={graphNodeMenuOpen} onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                }} onClick={(event) => {
                    event.stopPropagation();
                    toggleGraphNodeMenu();
                }}>

                          <Replace size={17} strokeWidth={1.8}/>

                          <span>
                            Change linked node
                          </span>

                          <ChevronRight size={15} strokeWidth={1.8} className={`notes-context-submenu-chevron ${graphNodeMenuOpen
                    ? "notes-context-submenu-chevron-open"
                    : ""}`}/>

                        </button>


                        {graphNodeMenuOpen && (<div className="notes-graph-node-menu" contentEditable={false} onMouseDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                    }} onClick={(event) => {
                        event.stopPropagation();
                    }}>

                            <div className="notes-graph-node-menu-heading">
                              Graph Nodes
                            </div>

                            <div className="notes-graph-node-menu-divider"/>

                            {graphNodeOptions.length > 0 && (<div className="graph-property-dropdown-search-wrap notes-graph-node-search-wrap" onMouseDown={(event) => {
                            event.stopPropagation();
                        }} onClick={(event) => {
                            event.stopPropagation();
                        }}>
                                <Search size={13} strokeWidth={1.8} aria-hidden="true"/>

                                <input type="text" className="graph-property-dropdown-search" value={graphNodeSearch} onChange={(event) => {
                            setGraphNodeSearch(event.target.value);
                        }} placeholder="Search graph nodes..." aria-label="Search graph nodes" autoFocus/>
                              </div>)}

                            <div className="notes-graph-node-menu-list">
                              {graphNodeOptions.length > 0 ? (filteredGraphNodeOptions.length > 0 ? (filteredGraphNodeOptions.map((node) => {
                        const isCurrentNode = String(node.id) ===
                            String(contextMenu.nodeId);
                        return (<button key={node.id} type="button" className={`notes-graph-node-menu-item ${isCurrentNode
                                ? "notes-graph-node-menu-item-current"
                                : ""}`} aria-current={isCurrentNode
                                ? "true"
                                : undefined} onMouseDown={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                            }} onClick={(event) => {
                                event.stopPropagation();
                                handleChangeLinkedNode(node);
                            }}>
                                        <span className="notes-graph-node-menu-item-content">
                                          <span className="notes-graph-node-linked-icon">
                                            {isCurrentNode && (<Link size={13} strokeWidth={2}/>)}
                                          </span>

                                          <span className="notes-graph-node-menu-label">
                                            {node.label}
                                          </span>
                                        </span>
                                      </button>);
                    })) : (<div className="notes-graph-node-menu-empty">
                                    No matching graph nodes
                                  </div>)) : (<div className="notes-graph-node-menu-empty">
                                  No graph nodes available
                                </div>)}
                            </div>

                          </div>)}

                      </div>

                      <button type="button" className="
                          notes-context-menu-item
                          notes-context-menu-danger
                        " onClick={(event) => {
                    event.stopPropagation();
                    removeGraphTextLink(contextMenu.linkId);
                }}>
                        <Unlink size={17} strokeWidth={1.8}/>

                        <span>
                          Remove graph link
                        </span>
                      </button>

                    </>)}

                </div>)}

          </div>

        </section>

        <div className="notes-graph-resizer" role="separator" aria-label="Resize Raw Notes and Graph View" aria-orientation="vertical" aria-valuemin={NOTES_GRAPH_MIN_SPLIT} aria-valuemax={NOTES_GRAPH_MAX_SPLIT} aria-valuenow={Math.round(notesGraphSplit)} tabIndex={0} onPointerDown={(event) => {
            if (typeof window !== "undefined" &&
                window.matchMedia("(max-width: 1100px)").matches) {
                return;
            }
            notesGraphDraggingRef.current = true;
            setIsResizingNotesGraph(true);
            event.currentTarget
                .setPointerCapture?.(event.pointerId);
            updateNotesGraphSplit(event.clientX);
        }} onPointerMove={(event) => {
            if (!notesGraphDraggingRef.current) {
                return;
            }
            updateNotesGraphSplit(event.clientX);
        }} onPointerUp={finishNotesGraphResize} onPointerCancel={finishNotesGraphResize} onKeyDown={handleNotesGraphResizeKeyDown}>
          <span className="notes-graph-resizer-line" aria-hidden="true"/>
        </div>

        {/* << GRAPH / AI CONNECTION >> */}
        {/* Provides current note text to GraphPanel */}
        {/* GraphPanel sends rawNotes to backend / AI */}

        <GraphPanel rawNotes={rawNotes} selectedText={selectedText} addNodeTrigger={addNodeTrigger} noteId={note.id} initialGraph={note.graph_json} ref={graphPanelRef} onNavigateLinkedText={openLinkedTextNavigator} isFocused={focusedPanel === "graph"} onToggleFocus={() => togglePanelFocus("graph")}/>
      </div>

        <div className="top-panels-resizer" role="separator" aria-label="Resize Raw Notes and Graph View height" aria-orientation="horizontal" aria-valuemin={TOP_PANELS_MIN_HEIGHT} aria-valuemax={TOP_PANELS_MAX_HEIGHT} aria-valuenow={Math.round(topPanelsHeight)} tabIndex={0} onPointerDown={(event) => {
            if (event.button !== 0) {
                return;
            }
            if (typeof window !== "undefined" &&
                window.matchMedia("(max-width: 1100px)").matches) {
                return;
            }
            const shell = topPanelsShellRef.current;
            if (!shell) {
                return;
            }
            const bounds = shell.getBoundingClientRect();
            topPanelsPointerOffsetRef.current =
                event.clientY - bounds.bottom;
            topPanelsDraggingRef.current = true;
            setIsResizingTopPanels(true);
            event.currentTarget
                .setPointerCapture?.(event.pointerId);
        }} onPointerMove={(event) => {
            if (!topPanelsDraggingRef.current) {
                return;
            }
            updateTopPanelsHeight(event.clientY);
        }} onPointerUp={finishTopPanelsResize} onPointerCancel={finishTopPanelsResize} onKeyDown={handleTopPanelsResizeKeyDown}>
          <span className="top-panels-resizer-grip" aria-hidden="true"/>
        </div>
      </div>

      {/* << SUMMARY / AI CONNECTION >> */}
      {/* Provides current note text to SummaryPanel */}
      {/* SummaryPanel sends rawNotes to backend / AI */}

      <div ref={summaryPanelShellRef} className={`summary-resizable-shell ${isResizingSummaryPanel
            ? "summary-panel-resizing"
            : ""}`} style={{
            "--summary-panel-height": `${summaryPanelHeight}px`,
        }}>
        <SummaryPanel rawNotes={rawNotes} summary={summary} onSummaryChange={setSummary} isFocused={focusedPanel === "summary"} onToggleFocus={() => togglePanelFocus("summary")}/>

        <div className="summary-panel-resizer" role="separator" aria-label="Resize Summary panel" aria-orientation="horizontal" aria-valuemin={SUMMARY_PANEL_MIN_HEIGHT} aria-valuemax={SUMMARY_PANEL_MAX_HEIGHT} aria-valuenow={Math.round(summaryPanelHeight)} tabIndex={0} onPointerDown={(event) => {
            if (event.button !== 0) {
                return;
            }
            const shell = summaryPanelShellRef.current;
            if (!shell) {
                return;
            }
            const bounds = shell.getBoundingClientRect();
            summaryPanelPointerOffsetRef.current =
                event.clientY - bounds.bottom;
            summaryPanelDraggingRef.current = true;
            setIsResizingSummaryPanel(true);
            event.currentTarget
                .setPointerCapture?.(event.pointerId);
        }} onPointerMove={(event) => {
            if (!summaryPanelDraggingRef.current) {
                return;
            }
            updateSummaryPanelHeight(event.clientY);
        }} onPointerUp={finishSummaryPanelResize} onPointerCancel={finishSummaryPanelResize} onKeyDown={handleSummaryPanelResizeKeyDown}>
          <span className="summary-panel-resizer-grip" aria-hidden="true"/>
        </div>
      </div>

      {transcriptionModalOpen && (<div className="transcription-modal-backdrop" role="presentation" onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                    closeTranscriptionModal();
                }
            }}>
          <section className="transcription-modal" role="dialog" aria-modal="true" aria-labelledby="transcription-modal-title" onMouseDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
            <header className="transcription-modal-header">
              <div className="transcription-modal-heading">
                <span className={`transcription-modal-icon ${transcriptionListening
                ? "transcription-modal-icon-listening"
                : ""}`} aria-hidden="true">
                  <Mic size={21} strokeWidth={1.9}/>
                </span>

                <div>
                  <h2 id="transcription-modal-title">Live Transcription</h2>
                  <p>Review and edit speech before adding it to Raw Notes.</p>
                </div>
              </div>

              <button type="button" className="transcription-modal-close" onClick={closeTranscriptionModal} aria-label="Close transcription">
                <X size={18} strokeWidth={1.9}/>
              </button>
            </header>

            <div className="transcription-modal-body">
              <div className="transcription-status-row">
                <div className="transcription-language-badge">
                  <Languages size={16} strokeWidth={1.8} aria-hidden="true"/>
                  <span>English</span>
                </div>

                <div className={`transcription-status ${transcriptionMicError || transcriptionAsrError
                ? "transcription-status-error"
                : transcriptionAsrState === "finalising"
                    ? "transcription-status-finalising"
                    : transcriptionAsrState === "connecting"
                        ? "transcription-status-connecting"
                        : transcriptionListening
                            ? "transcription-status-listening"
                            : transcriptionMicRequesting
                                ? "transcription-status-requesting"
                                : transcriptionCaptureInfo?.complete
                                    ? "transcription-status-captured"
                                    : ""}`} role="status" aria-live="polite">
                  <span className="transcription-status-dot" aria-hidden="true"/>
                  <span>
                    {transcriptionMicError
                ? "Microphone error"
                : transcriptionAsrError
                    ? "ASR connection error"
                    : transcriptionAsrState === "finalising"
                        ? "Finalising"
                        : transcriptionAsrState === "connecting"
                            ? "Connecting ASR"
                            : transcriptionListening
                                ? "Listening"
                                : transcriptionMicRequesting
                                    ? "Requesting access"
                                    : transcriptionCaptureInfo?.complete
                                        ? "Transcription ready"
                                        : "Ready"}
                  </span>
                </div>
              </div>

              <div className={`transcription-waveform ${transcriptionListening ? "transcription-waveform-active" : ""}`} aria-hidden="true">
                {Array.from({ length: 13 }).map((_, index) => {
                const wavePattern = [0.42, 0.68, 0.9, 0.58, 0.82, 1, 0.72, 0.94, 0.62, 0.84, 0.52, 0.76, 0.46];
                const liveHeight = transcriptionListening
                    ? 10 +
                        transcriptionAudioLevel *
                            42 *
                            wavePattern[index]
                    : 12;
                return (<span key={index} style={{
                        height: `${liveHeight}px`,
                    }}/>);
            })}
              </div>

              {transcriptionMicError || transcriptionAsrError ? (<p className="transcription-prototype-note transcription-microphone-error" role="alert">
                  {transcriptionMicError || transcriptionAsrError}
                </p>) : (<p className="transcription-prototype-note">
                  {transcriptionListening
                    ? `Microphone active. Streaming mono PCM audio to speech recognition at ${transcriptionCaptureInfo?.sampleRate?.toLocaleString() ?? "the browser's"} Hz.`
                    : transcriptionAsrState === "finalising"
                        ? "Finishing the last spoken phrase before closing the transcription session..."
                        : transcriptionCaptureInfo?.complete
                            ? `Captured ${transcriptionCaptureInfo.durationSeconds.toFixed(1)} seconds of audio at ${transcriptionCaptureInfo.sampleRate.toLocaleString()} Hz (${formatTranscriptionCaptureSize(transcriptionCaptureInfo.bytes)}). Review the transcript below before adding it to Raw Notes.`
                            : transcriptionAsrState === "connecting"
                                ? "Microphone access granted. Connecting to the speech recognition service..."
                                : transcriptionMicRequesting
                                    ? "Waiting for microphone permission from your browser..."
                                    : "Press Start Listening to begin live speech transcription."}
                </p>)}

              <label className="transcription-field" htmlFor="transcription-review-text">
                <span>Transcription</span>

                <textarea ref={transcriptionTextareaRef} id="transcription-review-text" value={transcriptionDraft} onChange={(event) => setTranscriptionDraft(event.target.value)} readOnly={transcriptionListening ||
                transcriptionMicRequesting ||
                transcriptionAsrState === "finalising"} placeholder="Your speech transcript will appear here. You can edit it before adding it to Raw Notes." spellCheck/>
              </label>

              <div className="transcription-terms-section">
                <div className="transcription-terms-copy">
                  <strong>Custom terminology</strong>
                  <span>Add jargon or names for your future personal ASR vocabulary.</span>
                </div>

                <div className="transcription-term-entry">
                  <input type="text" value={transcriptionTermInput} onChange={(event) => setTranscriptionTermInput(event.target.value)} onKeyDown={(event) => {
                if (event.key === "Enter") {
                    event.preventDefault();
                    addTranscriptionTerm();
                }
            }} placeholder="e.g. Kubernetes, TreeNotes, NumPy" aria-label="Custom transcription terminology"/>

                  <button type="button" className="transcription-term-add" onClick={addTranscriptionTerm} disabled={!transcriptionTermInput.trim()}>
                    <Plus size={16} strokeWidth={2} aria-hidden="true"/>
                    <span>Add</span>
                  </button>
                </div>

                {transcriptionTerms.length > 0 && (<div className="transcription-term-list" aria-label="Added custom terminology">
                    {transcriptionTerms.map((term) => (<span key={term} className="transcription-term-chip">
                        <span>{term}</span>
                        <button type="button" onClick={() => removeTranscriptionTerm(term)} aria-label={`Remove ${term}`}>
                          <X size={13} strokeWidth={2} aria-hidden="true"/>
                        </button>
                      </span>))}
                  </div>)}
              </div>
            </div>

            <footer className="transcription-modal-footer">
              <button type="button" className="transcription-footer-button transcription-clear-button" onClick={clearTranscriptionDraft} disabled={!transcriptionDraft ||
                transcriptionListening ||
                transcriptionMicRequesting ||
                transcriptionAsrState === "finalising"}>
                <Trash2 size={16} strokeWidth={1.9} aria-hidden="true"/>
                <span>Clear</span>
              </button>

              <div className="transcription-modal-actions">
                <button type="button" className={`transcription-footer-button transcription-listen-button ${transcriptionListening ? "transcription-listen-button-active" : ""}`} onClick={toggleTranscriptionListening} disabled={transcriptionMicRequesting ||
                transcriptionAsrState === "finalising"}>
                  {transcriptionListening ? (<Square size={15} strokeWidth={2} fill="currentColor" aria-hidden="true"/>) : (<Mic size={16} strokeWidth={1.9} aria-hidden="true"/>)}
                  <span>
                    {transcriptionAsrState === "connecting"
                ? "Connecting..."
                : transcriptionMicRequesting
                    ? "Requesting..."
                    : transcriptionAsrState === "finalising"
                        ? "Finalising..."
                        : transcriptionListening
                            ? "Stop"
                            : "Start Listening"}
                  </span>
                </button>

                <button type="button" className="transcription-footer-button transcription-append-button" onClick={appendTranscriptionToNotes} disabled={!transcriptionDraft.trim() ||
                transcriptionListening ||
                transcriptionMicRequesting ||
                transcriptionAsrState === "finalising"}>
                  <FilePlus2 size={17} strokeWidth={1.9} aria-hidden="true"/>
                  <span>Append to Raw Notes</span>
                </button>
              </div>
            </footer>
          </section>
        </div>)}
    </div>);
});
export default NoteWorkspace;