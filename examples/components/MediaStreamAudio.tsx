import { useEffect, useRef } from "react";

interface MediaStreamAudioProps {
    stream: MediaStream | undefined;
    muted?: boolean;
}

export const MediaStreamAudio = ({ stream, muted = false }: MediaStreamAudioProps) => {
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        console.log("Setting audio stream New:", stream);
        const audio = audioRef.current;
        if (!audio) return;

        if (stream) {
            audio.srcObject = stream;
            audio.autoplay = true;
            audio.muted = muted;

            const tryPlay = () => {
                console.log("Trying to play audio");
                audio.play().catch((err) => {
                    console.error("Error playing audio:", err);
                });
            };

            audio.addEventListener('canplay', tryPlay);

            return () => {
                audio.removeEventListener('canplay', tryPlay);
            };
        }
    }, [stream, muted]);

    return <audio 
        ref={audioRef}
        autoPlay
        playsInline
        muted={muted}
        style={{
            width: "100%",
        }}
    />;
};
