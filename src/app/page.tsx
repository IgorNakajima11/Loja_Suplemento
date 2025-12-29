"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";

/* ========= ASSETS ========= */
const ASSET_BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const INTRO_AUDIO_MP3 = `${ASSET_BASE}/audio/deboraapresentacao.mp3`;
const INTRO_AUDIO_M4A = `${ASSET_BASE}/audio/deboraapresentacao.m4a`;

/* ========= API ========= */
const RAW_API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";
const API_BASE =
  typeof window !== "undefined" &&
  RAW_API_BASE &&
  /^(https?:)\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(RAW_API_BASE) &&
  !/^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)
    ? ""
    : RAW_API_BASE;

const CONVERSATION_ENDPOINT = `${API_BASE}/api/conversation`;
const IS_ANDROID =
  typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);

/** Detecta se o microfone é “virtual”/emulador para ajustar constraints */
async function isEmulatorMic(): Promise<boolean> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const inputs = devices.filter((d) => d.kind === "audioinput");
    if (!inputs.length) return true;
    if (
      inputs.length === 1 &&
      (!inputs[0].label || /virtual|emulator/i.test(inputs[0].label))
    )
      return true;
    return false;
  } catch {
    return true;
  }
}

export default function Page() {
  const [isClicked, setIsClicked] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentVideo, setCurrentVideo] = useState("/testedefinitivo.webm");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showOptions, setShowOptions] = useState(true);

  // Mic / STT
  const [isListening, setIsListening] = useState(false);
  const [micError, setMicError] = useState("");
  const [transcript, setTranscript] = useState("");
  const [replyText, setReplyText] = useState("");

  // DOM
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Gravação
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const watchdogRef = useRef<number | null>(null);

  // WebAudio graph
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const highpassRef = useRef<BiquadFilterNode | null>(null);
  const compRef = useRef<DynamicsCompressorNode | null>(null);
  const preGainRef = useRef<GainNode | null>(null);
  const limiterRef = useRef<DynamicsCompressorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const processedDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);

  // VAD / silêncio
  const rafRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<number | null>(null);

  // Auto-fallback
  const activeProfileRef = useRef<"ns_on" | "ns_off">("ns_on");
  const initialMonitorRef = useRef<number | null>(null); // timeout id
  const rmsLogIdRef = useRef<number | null>(null); // logger de RMS

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.removeAttribute("controls");
      videoRef.current.controls = false;
      videoRef.current.addEventListener("contextmenu", (e) => e.preventDefault());
    }
    return () => {
      cleanupAudioGraph();
      stopMedia(true);
    };
  }, [isClicked]);

  /* ======== Áudio / TTS ======== */
  const playPreRecorded = async (preferM4A = false) => {
    if (!audioRef.current) return;
    setIsSpeaking(true);
    const audio = audioRef.current;

    const exists = async (url: string) => {
      try {
        const res = await fetch(url, { method: "HEAD" });
        return res.ok;
      } catch {
        return false;
      }
    };

    const canPlayM4A = audio.canPlayType('audio/mp4; codecs="mp4a.40.2"') !== "";
    let chosen = preferM4A && canPlayM4A ? INTRO_AUDIO_M4A : INTRO_AUDIO_MP3;
    if (!(await exists(chosen))) {
      const alt = chosen === INTRO_AUDIO_M4A ? INTRO_AUDIO_MP3 : INTRO_AUDIO_M4A;
      chosen = (await exists(alt)) ? alt : chosen;
    }

    audio.src = chosen;
    try {
      await audio.play();
    } catch {
      setTimeout(() => audio.play().catch(() => {}), 150);
    }
    audio.onended = () => setIsSpeaking(false);
  };

  /* ======== UI / Cenas ======== */
  const handleClick = () => {
    setIsClicked(true);
    setTimeout(() => playPreRecorded(true), 1100);
  };

  const changeVideo = (newSrc: string) => {
    if (isTransitioning || !videoRef.current) return;
    setIsTransitioning(true);
    const v = videoRef.current;
    v.style.transition = "opacity 1.2s ease-in-out, transform 1.2s ease-in-out";
    v.style.opacity = "0";
    v.style.transform = "scale(0.95)";
    setTimeout(() => {
      setCurrentVideo(newSrc);
      setTimeout(() => {
        if (!videoRef.current) return;
        const vv = videoRef.current;
        vv.style.transition = "opacity 2s ease-in-out, transform 2s ease-in-out";
        vv.style.opacity = "1";
        vv.style.transform = "scale(1)";
        setTimeout(() => setIsTransitioning(false), 500);
      }, 300);
    }, 1200);
  };

  const handleSupplementClick = () => {
    setShowOptions(false);
    setTimeout(() => {
      const claro = `${ASSET_BASE}/audio/Claro.m4a`;
      if (audioRef.current) {
        const audio = audioRef.current;
        audio.onended = null;
        audio.src = claro;
        audio.onended = () => {
          startMicFlow().catch((e) => console.error("Erro ao iniciar microfone:", e));
        };
        audio.play().catch(() => {});
      }
      changeVideo("/principal2.webm");
    }, 800);
  };

  /* ======== Mic com auto-detecção de emulador ======== */
  const startMicFlow = async () => {
    const emu = await isEmulatorMic();
    // Em emulador, comece já com NS/EC desligados (ns_off)
    await startRecording(emu ? "ns_off" : "ns_on");
  };

  async function startRecording(profile: "ns_on" | "ns_off") {
    setMicError("");

    if (
      !(window.isSecureContext ||
        location.protocol === "https:" ||
        ["localhost", "127.0.0.1"].includes(location.hostname))
    ) {
      setMicError("getUserMedia requer HTTPS ou localhost.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicError("Seu navegador não suporta captura de áudio.");
      return;
    }

    try {
      setTranscript("");
      setReplyText("");

      if (audioRef.current) {
        try {
          audioRef.current.pause();
          audioRef.current.muted = true;
        } catch {}
      }

      activeProfileRef.current = profile;

      const baseConstraints: MediaTrackConstraints =
        profile === "ns_on"
          ? {
              noiseSuppression: { ideal: true },
              echoCancellation: { ideal: true },
              autoGainControl: { ideal: true },
              channelCount: 1,
            }
          : {
              noiseSuppression: { ideal: false },
              echoCancellation: { ideal: false },
              autoGainControl: { ideal: true },
              channelCount: 1,
            };

      const rawStream = await navigator.mediaDevices.getUserMedia({
        audio: baseConstraints,
      });
      mediaStreamRef.current = rawStream;

      const ctx = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      audioCtxRef.current = ctx;

      const source = ctx.createMediaStreamSource(rawStream);
      sourceRef.current = source;

      // High-pass
      const highpass = ctx.createBiquadFilter();
      highpass.type = "highpass";
      highpass.frequency.value = 80;
      highpass.Q.value = 0.707;
      highpassRef.current = highpass;

      // Compressor suave
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -32;
      comp.knee.value = 24;
      comp.ratio.value = 3;
      comp.attack.value = 0.004;
      comp.release.value = 0.25;
      compRef.current = comp;

      // Ganho: mais alto com ns_off/Android
      const preGain = ctx.createGain();
      preGain.gain.value = profile === "ns_off" || IS_ANDROID ? 3.0 : 2.0;
      preGainRef.current = preGain;

      // Limiter
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -3;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.001;
      limiter.release.value = 0.08;
      limiterRef.current = limiter;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;

      const dest = ctx.createMediaStreamDestination();
      processedDestRef.current = dest;

      // graph
      source.connect(highpass);
      highpass.connect(comp);
      comp.connect(preGain);
      preGain.connect(limiter);
      limiter.connect(analyser);
      limiter.connect(dest);

      // MediaRecorder
      const mimeCandidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
      ];
      const chosenMime =
        mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || "";
      const recorder = new MediaRecorder(
        dest.stream,
        chosenMime ? { mimeType: chosenMime } : undefined
      );
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      // SEM gate: sempre envia
      const origOnStop = recorder.onstop;
      recorder.onstop = () => {
        // encerra logger RMS
        if (rmsLogIdRef.current) {
          window.clearInterval(rmsLogIdRef.current);
          rmsLogIdRef.current = null;
        }
        stopMedia(false);
        cleanupAudioGraph();
        processRecordedAudio()
          .catch((e) => console.error(e))
          .finally(() => {
            if (audioRef.current) audioRef.current.muted = false;
          });
        origOnStop?.call(recorder);
      };

      recorder.start(250);
      setIsListening(true);

      // VAD + ganho adaptativo
      watchSilenceAndAdaptiveGain();

      // Auto-fallback inicial (1.2s): se RMS muito baixo em ns_on, reinicia com ns_off
      if (initialMonitorRef.current) clearTimeout(initialMonitorRef.current);
      initialMonitorRef.current = window.setTimeout(() => {
        try {
          const rms = measureInstantRMS();
          if (activeProfileRef.current === "ns_on" && (rms < 0.006 || IS_ANDROID)) {
            stopRecording();
            stopMedia(true);
            cleanupAudioGraph();
            startRecording("ns_off");
          }
        } catch {}
      }, 1200);

      // watchdog (30s)
      watchdogRef.current = window.setTimeout(() => {
        if (mediaRecorderRef.current?.state === "recording") stopRecording();
      }, 30_000);

      // Logger de RMS (debug em emulador)
      if (rmsLogIdRef.current) {
        window.clearInterval(rmsLogIdRef.current);
        rmsLogIdRef.current = null;
      }
      rmsLogIdRef.current = window.setInterval(() => {
        const rms = measureInstantRMS();
        console.log(`[RMS ${activeProfileRef.current}]`, rms.toFixed(4));
      }, 500);
    } catch (err: any) {
      console.error("Erro ao acessar o microfone:", err);
      setMicError(err?.message || "Não foi possível acessar o microfone.");
      stopMedia(true);
      cleanupAudioGraph();
      if (audioRef.current) audioRef.current.muted = false;
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
  };

  const stopMedia = (abort: boolean) => {
    setIsListening(false);
    if (watchdogRef.current) {
      window.clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
    if (initialMonitorRef.current) {
      window.clearTimeout(initialMonitorRef.current);
      initialMonitorRef.current = null;
    }
    if (rmsLogIdRef.current) {
      window.clearInterval(rmsLogIdRef.current);
      rmsLogIdRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    if (abort && mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
  };

  const cleanupAudioGraph = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (silenceTimerRef.current) window.clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = null;

    try {
      sourceRef.current?.disconnect();
      highpassRef.current?.disconnect();
      compRef.current?.disconnect();
      preGainRef.current?.disconnect?.();
      limiterRef.current?.disconnect?.();
      analyserRef.current?.disconnect();
      processedDestRef.current?.disconnect?.();
    } catch {}

    sourceRef.current = null;
    highpassRef.current = null;
    compRef.current = null;
    preGainRef.current = null;
    limiterRef.current = null;
    analyserRef.current = null;
    processedDestRef.current = null;

    try {
      audioCtxRef.current?.close();
    } catch {}
    audioCtxRef.current = null;
  };

  /* ======== VAD + ganho adaptativo ======== */
  const watchSilenceAndAdaptiveGain = () => {
    const analyser = analyserRef.current;
    const preGain = preGainRef.current;
    if (!analyser || !preGain) return;

    const buffer = new Uint8Array(analyser.fftSize);
    const start = performance.now();

    const TARGET_RMS = IS_ANDROID ? 0.09 : 0.075;
    const GAIN_MIN = 1.5;
    const GAIN_MAX = IS_ANDROID ? 6.5 : 5.0;
    const ADAPT_RATE = 0.25;

    const loop = () => {
      analyser.getByteTimeDomainData(buffer);
      let sum = 0;
      for (let i = 0; i < buffer.length; i++) {
        const v = (buffer[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / buffer.length);

      // Ganho adaptativo
      const currentGain = preGain.gain.value;
      const desiredGain = clamp(
        currentGain * (TARGET_RMS / Math.max(0.00015, rms)),
        GAIN_MIN,
        GAIN_MAX
      );
      preGain.gain.value =
        currentGain + (desiredGain - currentGain) * ADAPT_RATE;

      // VAD permissivo
      const SILENCE_THRESHOLD = 0.0035;
      const MIN_RECORD_MS = 900;
      const SILENCE_HOLD_MS = 3200;

      const now = performance.now();
      const longEnough = now - start > MIN_RECORD_MS;

      if (rms < SILENCE_THRESHOLD && longEnough) {
        if (!silenceTimerRef.current) {
          silenceTimerRef.current = window.setTimeout(
            () => stopRecording(),
            SILENCE_HOLD_MS
          );
        }
      } else if (silenceTimerRef.current) {
        window.clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    loop();
  };

  const measureInstantRMS = () => {
    const analyser = analyserRef.current;
    if (!analyser) return 0;
    const buffer = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(buffer);
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      const v = (buffer[i] - 128) / 128;
      sum += v * v;
    }
    return Math.sqrt(sum / buffer.length);
  };

  const clamp = (v: number, lo: number, hi: number) =>
    Math.min(hi, Math.max(lo, v));

  /* ======== Pipeline -> /api/conversation ======== */
  const processRecordedAudio = async () => {
    try {
      const chunks = audioChunksRef.current;
      if (!chunks || chunks.length === 0) return;

      const firstType =
        (chunks[0].type && chunks[0].type !== "application/octet-stream")
          ? chunks[0].type
          : "audio/webm";
      const blob = new Blob(chunks, { type: firstType });
      const filename = firstType.includes("mp4") ? "audio.m4a" : "audio.webm";

      const form = new FormData();
      form.append("audio", blob, filename);

      const res = await fetch(CONVERSATION_ENDPOINT, {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error(`Erro na conversação (${res.status})`);

      const heardHeader = res.headers.get("x-transcript") || "";
      const replyHeader = res.headers.get("x-reply") || "";
      const heard = heardHeader ? decodeURIComponent(heardHeader) : "";
      const reply = replyHeader ? decodeURIComponent(replyHeader) : "";

      if (heard) setTranscript(heard);
      if (reply) setReplyText(reply);

      // ⚠️ Não bloqueia mais: apenas informa se o STT achou ruído/música
      if (
        !heard ||
        /\((?:intro\s+)?music\)|\(electronic sounds?\)|\(electronic crackling\)/i.test(
          heard
        )
      ) {
        setMicError(
          activeProfileRef.current === "ns_off"
            ? "O STT achou que era ruído (comum no emulador). Se puder, teste num aparelho físico ou use fone com microfone."
            : "O STT achou que era ruído. Troquei para perfil otimizado automaticamente; tente falar normalmente."
        );
        // segue fluxo normal
      }

      const type = res.headers.get("Content-Type") || "";
      if (!type.startsWith("audio/")) {
        const msg = await res.text().catch(() => "");
        throw new Error("Resposta inesperada: " + msg);
      }

      const replyBlob = await res.blob();
      const url = URL.createObjectURL(replyBlob);
      if (audioRef.current) {
        const audio = audioRef.current;
        audio.src = url;
        audio.oncanplaythrough = () => audio.play().catch(() => {});
        setIsSpeaking(true);
        audio.onended = () => setIsSpeaking(false);
      }
    } catch (e: any) {
      console.error("processRecordedAudio error:", e);
      setMicError(e?.message || "Erro ao processar áudio");
    } finally {
      if (audioRef.current) audioRef.current.muted = false;
    }
  };

  // 🔽 renderização
  return (
    <div className="relative w-screen h-screen overflow-hidden">
      {/* Fundo */}
      <img
        src="/fundo.jpg"
        alt="Loja de suplementos"
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-black/20 backdrop-blur-md" />

      <div className="absolute inset-0 flex items-end justify-center">
        {/* Intro */}
        <AnimatePresence>
          {!isClicked && (
            <motion.div
              key="videoInicial"
              initial={{ opacity: 1, scale: 1 }}
              exit={{
                opacity: 0,
                scale: 0.95,
                transition: { duration: 1.2, ease: "easeInOut" },
              }}
              onClick={handleClick}
              className="cursor-pointer absolute bottom-0"
            >
              <div className="intro-character">
                <video
                  src="/supawork-d00db6cfbd3f4bd182d54ca2307c1151.webm"
                  width={550}
                  height={550}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="object-contain translate-y-[10%]"
                  onContextMenu={(e) => e.preventDefault()}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Cena principal */}
        <AnimatePresence>
          {isClicked && (
            <motion.div
              key="animacaoLateral"
              initial={{ opacity: 0, x: "-100%", scale: 0.95 }}
              animate={{
                opacity: 1,
                x: "0%",
                scale: 1,
                transition: { duration: 2.0, ease: "easeInOut" },
              }}
              exit={{
                opacity: 0,
                scale: 0.95,
                transition: { duration: 1.2, ease: "easeInOut" },
              }}
              className="absolute bottom-0 left-0 flex items-center justify-center gap-8 pl-10"
            >
              <div className="character-left">
                <div className="relative">
                  <video
                    ref={videoRef}
                    key={currentVideo}
                    src={currentVideo}
                    autoPlay
                    muted
                    playsInline
                    disablePictureInPicture
                    disableRemotePlayback
                    width={550}
                    height={550}
                    className="object-contain translate-y-[10%]"
                    onContextMenu={(e) => e.preventDefault()}
                    style={{
                      opacity: 1,
                      pointerEvents: "none",
                      userSelect: "none",
                      WebkitUserSelect: "none",
                      transition:
                        "opacity 2s ease-in-out, transform 2s ease-in-out",
                    }}
                  />
                </div>
              </div>

              {/* Opções */}
              <AnimatePresence>
                {showOptions && (
                  <motion.div
                    key="options"
                    initial={{ opacity: 0, x: 60 }}
                    animate={{
                      opacity: 1,
                      x: 0,
                      transition: { delay: 1.0, duration: 0.9, ease: "easeOut" },
                    }}
                    exit={{
                      opacity: 0,
                      x: 40,
                      transition: { duration: 0.9, ease: "easeInOut" },
                    }}
                    className="flex flex-col space-y-4 self-center translate-y-[10%]"
                  >
                    <motion.button
                      onClick={handleSupplementClick}
                      whileHover={{ scale: !isSpeaking ? 1.02 : 1 }}
                      whileTap={{ scale: !isSpeaking ? 0.98 : 1 }}
                      disabled={isSpeaking || isTransitioning}
                      className={`px-8 py-4 rounded-lg text-white text-base font-medium shadow-sm backdrop-blur-xl border border-white/20 transition-colors ${
                        isSpeaking || isTransitioning
                          ? "bg-white/5 cursor-not-allowed opacity-50"
                          : "bg-white/10 hover:bg-white/15"
                      }`}
                    >
                      Quero saber mais sobre suplementação em geral!
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: !isSpeaking ? 1.02 : 1 }}
                      whileTap={{ scale: !isSpeaking ? 0.98 : 1 }}
                      disabled={isSpeaking}
                      className={`px-8 py-4 rounded-lg text-white text-base font-medium shadow-sm backdrop-blur-xl border border-white/20 transition-colors ${
                        isSpeaking
                          ? "bg-white/5 cursor-not-allowed opacity-50"
                          : "bg-white/10 hover:bg-white/15"
                      }`}
                    >
                      Quero saber mais sobre a loja
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* UI do microfone */}
      {isListening && (
        <div className="absolute bottom-6 right-6 px-4 py-2 rounded-lg bg-white/20 backdrop-blur-md text-white text-sm border border-white/25 shadow">
          🎙️ Gravando… fale normalmente (não precisa gritar)
        </div>
      )}
      {micError && (
        <div className="absolute bottom-20 right-6 max-w-[60ch] px-3 py-2 rounded bg-red-500/80 text-white text-xs shadow">
          {micError}
        </div>
      )}

      {/* Debug opcional */}
      {!!transcript && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-4 text-white/80 text-xs">
          Você disse: “{transcript}”
        </div>
      )}
      {!!replyText && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-8 text-white/80 text-xs">
          Resposta: “{replyText}”
        </div>
      )}

      {/* Player de áudio */}
      <audio ref={audioRef} preload="auto">
        <source src={INTRO_AUDIO_MP3} type="audio/mpeg" />
        <source src={INTRO_AUDIO_M4A} type="audio/mp4" />
      </audio>

      {/* Escala responsiva */}
      <style jsx global>{`
        .intro-character {
          transform-origin: bottom center;
          transform: scale(1);
          transition: transform 250ms ease;
          will-change: transform;
        }
        .character-left {
          transform-origin: bottom left;
          transform: scale(1);
          transition: transform 250ms ease;
          will-change: transform;
        }
        @media (max-width: 1280px) {
          .intro-character,
          .character-left {
            transform: scale(0.75);
          }
        }
        @media (max-width: 1100px) {
          .intro-character,
          .character-left {
            transform: scale(0.62);
          }
        }
        @media (max-width: 1024px) {
          .intro-character,
          .character-left {
            transform: scale(0.55);
          }
        }
        @media (max-width: 900px) {
          .intro-character,
          .character-left {
            transform: scale(0.5);
          }
        }
        @media (max-width: 820px) {
          .intro-character,
          .character-left {
            transform: scale(0.45);
          }
        }
        @media (max-width: 768px) {
          .intro-character,
          .character-left {
            transform: scale(0.38);
          }
        }
        @media (max-width: 700px) {
          .intro-character,
          .character-left {
            transform: scale(0.34);
          }
        }
        @media (max-width: 600px) {
          .intro-character,
          .character-left {
            transform: scale(0.3);
          }
        }
        @media (max-width: 520px) {
          .intro-character,
          .character-left {
            transform: scale(0.26);
          }
        }
      `}</style>
    </div>
  );
}
