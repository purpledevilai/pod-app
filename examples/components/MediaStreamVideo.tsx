import { useEffect, useRef } from "react";

interface MediaStreamVideoProps {
    stream: MediaStream | undefined;
    muted?: boolean;
}

export const MediaStreamVideo = ({ stream, muted = false }: MediaStreamVideoProps) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        console.log("Setting video stream:", stream);
        if (videoRef.current) {
            videoRef.current.srcObject = stream || null;
        }
    }, [stream]);

    return <video 
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: "8px",
        }}
    />;
};
