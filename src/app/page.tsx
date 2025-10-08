"use client";

import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect } from "react";

export default function Page() {
  const [isClicked, setIsClicked] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.removeAttribute("controls");
      videoRef.current.controls = false;
      videoRef.current.addEventListener("contextmenu", (e) => e.preventDefault());
    }
  }, [isClicked]);

  // ✅ Função otimizada: começa o áudio o mais rápido possível
  const handleClick = async () => {
    setIsClicked(true);

    // Texto de apresentação
    const texto =
      "Olá! Eu sou a Débora, sua assistente virtual da Four Nutrition. Como posso te ajudar hoje?";

    // ⚡ já define que ela está falando, antes do fetch começar
    setIsSpeaking(true);

    try {
      const response = await fetch("http://localhost:3001/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: texto }),
      });

      if (!response.ok) throw new Error("Erro ao gerar fala");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);

      // 🚀 Assim que o áudio está pronto, toca imediatamente
      if (audioRef.current) {
        const audio = audioRef.current;
        audio.src = url;
        // força início assim que o navegador permitir
        audio.oncanplaythrough = () => {
          audio.play().catch((err) => console.warn("Erro ao tocar áudio:", err));
        };
        audio.onended = () => setIsSpeaking(false);
      }
    } catch (err) {
      console.error("Erro no TTS:", err);
      setIsSpeaking(false);
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      {/* Fundo */}
      <Image src="/fundo.jpg" alt="Loja de suplementos" fill className="object-cover" priority />

      {/* Camada de blur */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-md" />

      {/* Camada principal */}
      <div className="absolute inset-0 flex items-end justify-center">
        {/* Personagem inicial */}
        <AnimatePresence>
          {!isClicked && (
            <motion.div
              key="central"
              initial={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.5 } }}
              onClick={handleClick}
              className="cursor-pointer absolute bottom-0"
            >
              <Image
                src="/avatar1.png"
                alt="Mascote Four Nutrition"
                width={550}
                height={550}
                className="object-contain translate-y-[10%]"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Personagem animado e botões */}
        <AnimatePresence>
          {isClicked && (
            <motion.div
              key="canto-esquerdo"
              initial={{ x: "-100%", opacity: 0 }}
              animate={{
                x: "0%",
                opacity: 1,
                transition: { type: "spring", stiffness: 100, damping: 15, duration: 0.8 },
              }}
              className="absolute bottom-0 left-0 flex items-center justify-center gap-8 pl-10"
            >
              {/* Vídeo animado */}
              <div className="relative">
                <video
                  ref={videoRef}
                  src="/supawork-088a86a80c764d83b2e436a9e3bcc7d1.webm"
                  autoPlay
                  loop
                  muted
                  playsInline
                  disablePictureInPicture
                  disableRemotePlayback
                  width={550}
                  height={550}
                  className="object-contain translate-y-[10%]"
                  style={{
                    pointerEvents: "none",
                    userSelect: "none",
                    WebkitUserSelect: "none",
                  }}
                  onContextMenu={(e) => e.preventDefault()}
                />
              </div>

              {/* Botões */}
              <motion.div
                key="options"
                initial={{ opacity: 0, x: 50 }}
                animate={{
                  opacity: 1,
                  x: 0,
                  transition: { delay: 0.8, duration: 0.6 },
                }}
                exit={{ opacity: 0, x: 30 }}
                className="flex flex-col space-y-4"
              >
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Áudio invisível */}
      <audio ref={audioRef} />
    </div>
  );
}
