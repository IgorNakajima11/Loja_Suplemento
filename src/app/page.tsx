"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect } from "react";

export default function Page() {
  const [isClicked, setIsClicked] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [currentVideo, setCurrentVideo] = useState("/principais.webm");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showOptions, setShowOptions] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Configuração inicial do vídeo
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.removeAttribute("controls");
      videoRef.current.controls = false;
      videoRef.current.addEventListener("contextmenu", (e) => e.preventDefault());
    }
  }, [isClicked]);

  // Função de fala (TTS)
  const speak = async (text: string) => {
    setIsSpeaking(true);
    try {
      const response = await fetch("http://localhost:3001/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) throw new Error("Erro ao gerar fala");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);

      if (audioRef.current) {
        const audio = audioRef.current;
        audio.src = url;
        audio.oncanplaythrough = () => audio.play().catch(() => {});
        audio.onended = () => setIsSpeaking(false);
      }
    } catch (err) {
      console.error("Erro no TTS:", err);
      setIsSpeaking(false);
    }
  };

  // Clique inicial
  const handleClick = () => {
    setIsClicked(true);
    speak("Olá! Eu sou a Débora, sua assistente virtual da Four Nutrition. Como posso te ajudar hoje?");
  };

  // Transição de troca de vídeo (suave e lenta)
  const changeVideo = (newSrc: string) => {
    if (isTransitioning || !videoRef.current) return;
    setIsTransitioning(true);

    videoRef.current.style.transition = "opacity 1.2s ease-in-out, transform 1.2s ease-in-out";
    videoRef.current.style.opacity = "0";
    videoRef.current.style.transform = "scale(0.95)";

    setTimeout(() => {
      setCurrentVideo(newSrc);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.style.transition = "opacity 2s ease-in-out, transform 2s ease-in-out";
          videoRef.current.style.opacity = "1";
          videoRef.current.style.transform = "scale(1)";
        }
        setTimeout(() => {
          setIsTransitioning(false);
        }, 500);
      }, 300);
    }, 1200);
  };

  // Clique na opção de suplementação
  const handleSupplementClick = () => {
    setShowOptions(false);
    setTimeout(() => {
      speak("Claro! Estou aqui para responder qualquer dúvida sobre suplementação. Pode perguntar!");
      changeVideo("/principal2.webm");
    }, 800);
  };

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
        {/* Animação inicial */}
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
            </motion.div>
          )}
        </AnimatePresence>

        {/* Cena principal após clique (transição mais lenta e suave) */}
        <AnimatePresence>
          {isClicked && (
            <motion.div
              key="animacaoLateral"
              initial={{ opacity: 0, x: "-100%", scale: 0.95 }}
              animate={{
                opacity: 1,
                x: "0%",
                scale: 1,
                transition: {
                  duration: 2.0, // igual ao fade in da troca de vídeo
                  ease: "easeInOut",
                },
              }}
              exit={{
                opacity: 0,
                scale: 0.95,
                transition: { duration: 1.2, ease: "easeInOut" },
              }}
              className="absolute bottom-0 left-0 flex items-center justify-center gap-8 pl-10"
            >
              {/* Personagem */}
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
                  width={700}
                  height={700}
                  className="object-contain translate-y-[10%]"
                  onContextMenu={(e) => e.preventDefault()}
                  style={{
                    opacity: 1,
                    pointerEvents: "none",
                    userSelect: "none",
                    WebkitUserSelect: "none",
                    transition: "opacity 2s ease-in-out, transform 2s ease-in-out",
                  }}
                />
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
                    className="flex flex-col space-y-4"
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

      {/* Player de áudio */}
      <audio ref={audioRef} />
    </div>
  );
}
