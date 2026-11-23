import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  AlertCircle,
  Download,
  Pause,
  Play,
  Sparkles,
  Volume2,
} from "lucide-react";

interface AudioClip {
  id: string;
  label: string;
  sublabel: string;
  audioDataUrl: string;
  createdAt: number;
}

const VOICES = [
  { id: "Kore", note: "Warm & clear" },
  { id: "Puck", note: "Bright & lively" },
  { id: "Charon", note: "Deep & steady" },
  { id: "Fenrir", note: "Bold & crisp" },
  { id: "Zephyr", note: "Smooth & calm" },
];

const STYLE_PRESETS = [
  "Warm, natural storyteller",
  "Crisp, upbeat podcast host",
  "Calm, thoughtful guide",
  "Energetic product announcer",
];

const SYNTHESIS_STAGES = [
  "Shaping vocal tone",
  "Rendering 24 kHz waveform",
  "Mastering studio WAV",
];

function formatSeconds(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function InteractiveAudioCard({ clip }: { clip: AudioClip }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceConnectedRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState<1 | 1.25 | 1.5>(1);

  const drawIdleBars = (progressRatio: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const bars = 44;
    const gap = 3;
    const barW = (w - gap * (bars - 1)) / bars;
    for (let i = 0; i < bars; i++) {
      const seed = Math.sin(i * 0.65) * 0.45 + Math.cos(i * 1.3) * 0.25 + 0.55;
      const barH = Math.max(6, Math.min(h - 6, seed * (h * 0.72)));
      const x = i * (barW + gap);
      const y = (h - barH) / 2;
      const played = i / bars <= progressRatio;
      ctx.fillStyle = played ? "#F01271" : "rgba(255, 255, 255, 0.16)";
      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH, 3);
      ctx.fill();
    }
  };

  useEffect(() => {
    drawIdleBars(duration > 0 ? currentTime / duration : 0);
  }, [currentTime, duration]);

  useEffect(() => {
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        void audioCtxRef.current.close();
      }
    };
  }, []);

  const startVisualizer = () => {
    const audio = audioRef.current;
    const canvas = canvasRef.current;
    if (!audio || !canvas) return;

    if (!sourceConnectedRef.current) {
      try {
        const Ctx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        const audioCtx = new Ctx();
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 128;
        const source = audioCtx.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(audioCtx.destination);
        audioCtxRef.current = audioCtx;
        analyserRef.current = analyser;
        sourceConnectedRef.current = true;
      } catch {
        // Fallback to idle progress bars if AudioContext restricted
      }
    }

    if (audioCtxRef.current?.state === "suspended") {
      void audioCtxRef.current.resume();
    }

    const renderFrame = () => {
      const analyser = analyserRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx || !analyser || audio.paused) {
        return;
      }

      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const bars = 44;
      const gap = 3;
      const barW = (w - gap * (bars - 1)) / bars;

      for (let i = 0; i < bars; i++) {
        const binIdx = Math.floor((i / bars) * (data.length * 0.75));
        const norm = (data[binIdx] || 0) / 255;
        const barH = Math.max(6, norm * (h - 6));
        const x = i * (barW + gap);
        const y = (h - barH) / 2;

        const grad = ctx.createLinearGradient(0, y, 0, y + barH);
        grad.addColorStop(0, "#FFC800");
        grad.addColorStop(1, "#F01271");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, y, barW, barH, 3);
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(renderFrame);
    };

    if (analyserRef.current) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      animRef.current = requestAnimationFrame(renderFrame);
    }
  };

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      await audio.play();
      setIsPlaying(true);
      startVisualizer();
    } else {
      audio.pause();
      setIsPlaying(false);
      if (animRef.current) cancelAnimationFrame(animRef.current);
      drawIdleBars(duration > 0 ? audio.currentTime / duration : 0);
    }
  };

  const cycleRate = () => {
    const next: 1 | 1.25 | 1.5 = rate === 1 ? 1.25 : rate === 1.25 ? 1.5 : 1;
    setRate(next);
    if (audioRef.current) {
      audioRef.current.playbackRate = next;
    }
  };

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = clip.audioDataUrl;
    a.download = `build-buds-audio-${clip.id.slice(0, 6)}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-2xl bg-[#11131C] border border-white/10 p-4 space-y-3"
    >
      <audio
        ref={audioRef}
        src={clip.audioDataUrl}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
          if (animRef.current) cancelAnimationFrame(animRef.current);
          drawIdleBars(0);
        }}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white truncate">
            {clip.label}
          </div>
          <div className="text-xs text-[#8E96AA] mt-0.5">{clip.sublabel}</div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={cycleRate}
            className="px-2.5 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/10 text-xs font-mono tabular-nums text-[#D1D5E2] transition-colors cursor-pointer"
          >
            {rate}x
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/12 text-xs font-medium text-white transition-colors cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-[#FFC800]" />
            <span>WAV</span>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void togglePlay()}
          className="w-10 h-10 rounded-xl bg-[#F01271] hover:bg-[#D90D64] text-white flex items-center justify-center shrink-0 transition-transform active:scale-95 cursor-pointer"
          aria-label={isPlaying ? "Pause audio" : "Play audio"}
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 fill-current ml-0.5" />
          )}
        </button>

        <canvas
          ref={canvasRef}
          width={420}
          height={44}
          onClick={(e) => {
            const audio = audioRef.current;
            if (!audio || !duration) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = Math.max(
              0,
              Math.min(1, (e.clientX - rect.left) / rect.width)
            );
            audio.currentTime = ratio * duration;
            setCurrentTime(audio.currentTime);
          }}
          className="flex-1 h-11 w-full cursor-pointer"
        />

        <span className="text-xs font-mono tabular-nums text-[#9CA3B4] shrink-0">
          {formatSeconds(currentTime)} / {formatSeconds(duration)}
        </span>
      </div>
    </motion.div>
  );
}

export function AudioStudio() {
  const [mode, setMode] = useState<"single" | "dialogue">("single");
  const [text, setText] = useState("");
  const [voice, setVoice] = useState("Kore");
  const [style, setStyle] = useState(STYLE_PRESETS[0]);

  const [speaker1Name, setSpeaker1Name] = useState("Alex");
  const [speaker1Voice, setSpeaker1Voice] = useState("Puck");
  const [speaker1Text, setSpeaker1Text] = useState("");

  const [speaker2Name, setSpeaker2Name] = useState("Sam");
  const [speaker2Voice, setSpeaker2Voice] = useState("Kore");
  const [speaker2Text, setSpeaker2Text] = useState("");

  const [isGenerating, setIsGenerating] = useState(false);
  const [stageIdx, setStageIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [clips, setClips] = useState<AudioClip[]>([]);

  useEffect(() => {
    if (!isGenerating) {
      setStageIdx(0);
      return;
    }
    const timer = window.setInterval(() => {
      setStageIdx((prev) => (prev + 1) % SYNTHESIS_STAGES.length);
    }, 1100);
    return () => window.clearInterval(timer);
  }, [isGenerating]);

  const handleGenerate = async () => {
    if (isGenerating) return;
    setError(null);
    setIsGenerating(true);

    try {
      const payload =
        mode === "single"
          ? { mode: "single", text, voice, style }
          : {
              mode: "dialogue",
              speaker1Name,
              speaker1Voice,
              speaker1Text,
              speaker2Name,
              speaker2Voice,
              speaker2Text,
            };

      const res = await fetch("/api/audio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as {
        audioDataUrl?: string;
        error?: string;
      };

      if (!res.ok || !data.audioDataUrl) {
        throw new Error(data.error || "Could not synthesize audio.");
      }

      const clipLabel =
        mode === "single"
          ? text.trim().slice(0, 54) + (text.trim().length > 54 ? "…" : "")
          : `${speaker1Name} & ${speaker2Name} dialogue`;

      const newClip: AudioClip = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        label: clipLabel,
        sublabel:
          mode === "single"
            ? `${voice} · ${style || "Natural"}`
            : `${speaker1Voice} + ${speaker2Voice} · Dual-speaker`,
        audioDataUrl: data.audioDataUrl,
        createdAt: Date.now(),
      };

      setClips((prev) => [newClip, ...prev]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Audio synthesis failed."
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const canSubmit =
    !isGenerating &&
    (mode === "single"
      ? text.trim().length > 0
      : speaker1Text.trim().length > 0 && speaker2Text.trim().length > 0);

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-white tracking-tight">
              Audio Creation
            </h1>
            <p className="text-sm text-[#9CA3B4] mt-1">
              Turn any script into studio-grade speech or two-speaker dialogue.
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-xl bg-[#11131C] border border-white/10 self-start">
            <button
              type="button"
              onClick={() => setMode("single")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                mode === "single"
                  ? "bg-[#F01271] text-white"
                  : "text-[#9CA3B4] hover:text-white"
              }`}
            >
              Single Voice
            </button>
            <button
              type="button"
              onClick={() => setMode("dialogue")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                mode === "dialogue"
                  ? "bg-[#F01271] text-white"
                  : "text-[#9CA3B4] hover:text-white"
              }`}
            >
              Two-Speaker
            </button>
          </div>
        </div>

        {/* Form Surface */}
        <div className="rounded-2xl bg-[#11131C] border border-white/10 p-5 space-y-5">
          {mode === "single" ? (
            <>
              <div>
                <label className="block text-xs font-medium text-[#C8CDDC] mb-2">
                  Voice
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {VOICES.map((v) => {
                    const active = voice === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setVoice(v.id)}
                        className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                          active
                            ? "bg-[#1A1E2E] border-[#FFC800] text-white"
                            : "bg-[#0B0D14] border-white/8 text-[#9CA3B4] hover:text-white hover:border-white/20"
                        }`}
                      >
                        <div className="text-xs font-semibold">{v.id}</div>
                        <div className="text-[11px] text-[#7F879B] mt-0.5">
                          {v.note}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label
                  htmlFor="audio-style-input"
                  className="block text-xs font-medium text-[#C8CDDC] mb-2"
                >
                  Delivery Style
                </label>
                <input
                  id="audio-style-input"
                  type="text"
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                  placeholder="e.g. Warm, natural storyteller"
                  className="w-full rounded-xl bg-[#0B0D14] border border-white/10 px-3.5 py-2.5 text-sm text-white placeholder:text-[#6F778C] focus:outline-none focus:border-[#FFC800]/60"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {STYLE_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setStyle(preset)}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[#9CA3B4] hover:text-white transition-colors cursor-pointer"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="audio-script-input"
                  className="block text-xs font-medium text-[#C8CDDC] mb-2"
                >
                  Script
                </label>
                <textarea
                  id="audio-script-input"
                  rows={4}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Write what you want Build Buds to speak..."
                  className="w-full rounded-xl bg-[#0B0D14] border border-white/10 px-3.5 py-3 text-sm text-white placeholder:text-[#6F778C] focus:outline-none focus:border-[#FFC800]/60 resize-none leading-relaxed"
                />
              </div>
            </>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-3 p-3.5 rounded-xl bg-[#0B0D14] border border-white/8">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={speaker1Name}
                    onChange={(e) => setSpeaker1Name(e.target.value)}
                    aria-label="Speaker 1 name"
                    className="flex-1 bg-[#11131C] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#FFC800] focus:outline-none"
                  />
                  <select
                    value={speaker1Voice}
                    onChange={(e) => setSpeaker1Voice(e.target.value)}
                    aria-label="Speaker 1 voice"
                    className="bg-[#11131C] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                  >
                    {VOICES.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.id}
                      </option>
                    ))}
                  </select>
                </div>
                <textarea
                  rows={3}
                  value={speaker1Text}
                  onChange={(e) => setSpeaker1Text(e.target.value)}
                  placeholder="First speaker line..."
                  className="w-full bg-transparent text-sm text-white placeholder:text-[#6F778C] focus:outline-none resize-none leading-relaxed"
                />
              </div>

              <div className="space-y-3 p-3.5 rounded-xl bg-[#0B0D14] border border-white/8">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={speaker2Name}
                    onChange={(e) => setSpeaker2Name(e.target.value)}
                    aria-label="Speaker 2 name"
                    className="flex-1 bg-[#11131C] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#F01271] focus:outline-none"
                  />
                  <select
                    value={speaker2Voice}
                    onChange={(e) => setSpeaker2Voice(e.target.value)}
                    aria-label="Speaker 2 voice"
                    className="bg-[#11131C] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                  >
                    {VOICES.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.id}
                      </option>
                    ))}
                  </select>
                </div>
                <textarea
                  rows={3}
                  value={speaker2Text}
                  onChange={(e) => setSpeaker2Text(e.target.value)}
                  placeholder="Second speaker reply..."
                  className="w-full bg-transparent text-sm text-white placeholder:text-[#6F778C] focus:outline-none resize-none leading-relaxed"
                />
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-[#1A1219] border border-[#F01271]/40 px-4 py-3 text-sm text-[#FFD2E3] flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-[#F01271] shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-between gap-4 pt-1">
            <div className="text-xs text-[#8E96AA] flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-[#FFC800]" />
              <span>Outputs lossless 24 kHz WAV audio</span>
            </div>

            <button
              type="button"
              onClick={() => void handleGenerate()}
              disabled={!canSubmit}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#F01271] hover:bg-[#D90D64] disabled:bg-white/8 disabled:text-[#6F778C] text-white text-sm font-semibold transition-all active:scale-97 whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isGenerating ? "Synthesizing..." : "Generate Audio"}</span>
            </button>
          </div>
        </div>

        {/* Satisfying Generation Progress Animation */}
        <AnimatePresence>
          {isGenerating && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="rounded-2xl bg-[#11131C] border border-[#FFC800]/30 p-5 flex flex-col items-center text-center gap-4"
            >
              <div className="flex items-end gap-1.5 h-10" aria-hidden="true">
                {Array.from({ length: 14 }).map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-1.5 rounded-full"
                    style={{
                      background: i % 2 === 0 ? "#FFC800" : "#F01271",
                    }}
                    animate={{
                      scaleY: [0.25, 0.95, 0.4, 1, 0.3],
                    }}
                    transition={{
                      duration: 0.95,
                      repeat: Infinity,
                      delay: i * 0.06,
                      ease: "easeInOut",
                    }}
                  />
                ))}
              </div>
              <div>
                <div className="text-sm font-semibold text-white">
                  {SYNTHESIS_STAGES[stageIdx]}
                </div>
                <div className="text-xs text-[#8E96AA] mt-1">
                  Crafting natural cadence and acoustic clarity
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Generated Clips */}
        {clips.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xs font-semibold text-[#8E96AA] px-1">
              Generated Audio
            </h2>
            {clips.map((clip) => (
              <InteractiveAudioCard key={clip.id} clip={clip} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
