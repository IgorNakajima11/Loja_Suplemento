"use client";

import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect } from "react";

export default function Page() {
  const [isClicked, setIsClicked] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      // Remove todos os atributos de controles
      videoRef.current.removeAttribute('controls');
      videoRef.current.controls = false;
      
      // Previne menu de contexto
      videoRef.current.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        return false;
      });
    }
  }, [isClicked]);

  const handleClick = () => {
    setIsClicked(true);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      {/* Fundo */}
      <Image
        src="/fundo.jpg"
        alt="Loja de suplementos"
        fill
        className="object-cover"
        priority
      />

      {/* Camada de blur */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-md" />

      {/* Camada de conteúdo */}
      <div className="absolute inset-0 flex items-end justify-center">
        {/* Personagem central - desaparece ao clicar */}
        <AnimatePresence>
          {!isClicked && (
            <motion.div
              key="central"
              initial={{ opacity: 1, scale: 1 }}
              exit={{
                opacity: 0,
                scale: 0.8,
                transition: { duration: 0.5 },
              }}
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

        {/* Personagem no canto esquerdo - vídeo transparente após clique */}
        <AnimatePresence>
          {isClicked && (
            <motion.div
              key="canto-esquerdo"
              initial={{ x: "-100%", opacity: 0 }}
              animate={{
                x: "0%",
                opacity: 1,
                transition: {
                  type: "spring",
                  stiffness: 100,
                  damping: 15,
                  duration: 0.8,
                },
              }}
              className="absolute bottom-0 left-0"
            >
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
                    pointerEvents: 'none',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                  }}
                  onContextMenu={(e) => e.preventDefault()}
                />
                <div 
                  className="absolute inset-0 z-10" 
                  style={{ 
                    pointerEvents: 'auto',
                    cursor: 'default'
                  }}
                  onContextMenu={(e) => e.preventDefault()}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}