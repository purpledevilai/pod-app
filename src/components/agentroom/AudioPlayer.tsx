import { useEffect, useRef } from 'react';
import { MediaStream, RTCView } from 'react-native-webrtc';

interface AudioPlayerProps {
    stream: MediaStream | undefined;
}

/**
 * AudioPlayer - Plays the inbound audio stream from the agent
 * Uses RTCView component from react-native-webrtc in audio-only mode
 */
export const AudioPlayer = ({ stream }: AudioPlayerProps) => {
    const hasStream = useRef(false);

    useEffect(() => {
        if (stream) {
            console.log('[AudioPlayer] Audio stream received:', stream.id);
            hasStream.current = true;
        } else {
            console.log('[AudioPlayer] No audio stream');
            hasStream.current = false;
        }
    }, [stream]);

    // RTCView is used even for audio-only streams in react-native-webrtc
    // The component handles audio playback internally
    if (!stream) {
        return null;
    }

    return (
        <RTCView
            streamURL={stream.toURL()}
            style={{ width: 0, height: 0 }} // Hidden - audio only
            objectFit="cover"
            mirror={false}
        />
    );
};

