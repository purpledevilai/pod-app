import { RTCPeerConnection } from 'react-native-webrtc';

/**
 * AudioLevelMonitor - Monitors audio levels from a WebRTC peer connection
 * 
 * Uses RTCPeerConnection.getStats() to retrieve audio level data from RTP statistics.
 * The audioLevel value is normalized between 0.0 and 1.0.
 */
export class AudioLevelMonitor {
    private pc: RTCPeerConnection;
    private trackType: 'inbound' | 'outbound';
    private intervalId: ReturnType<typeof setInterval> | null = null;
    private onLevelChange: (level: number) => void;
    private pollIntervalMs: number;
    private isRunning = false;

    constructor(config: {
        peerConnection: RTCPeerConnection;
        trackType: 'inbound' | 'outbound';
        onLevelChange: (level: number) => void;
        pollIntervalMs?: number;
    }) {
        this.pc = config.peerConnection;
        this.trackType = config.trackType;
        this.onLevelChange = config.onLevelChange;
        this.pollIntervalMs = config.pollIntervalMs ?? 100; // Default 100ms for ~10fps updates
    }

    /**
     * Start monitoring audio levels
     */
    start() {
        if (this.isRunning) {
            console.log('[AudioLevelMonitor] Already running');
            return;
        }

        console.log(`[AudioLevelMonitor] Starting ${this.trackType} audio monitoring`);
        this.isRunning = true;

        this.intervalId = setInterval(() => {
            this.pollAudioLevel();
        }, this.pollIntervalMs);
    }

    /**
     * Stop monitoring audio levels
     */
    stop() {
        if (!this.isRunning) {
            return;
        }

        console.log(`[AudioLevelMonitor] Stopping ${this.trackType} audio monitoring`);
        this.isRunning = false;

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    /**
     * Poll the peer connection for audio level stats
     */
    private async pollAudioLevel() {
        try {
            const stats = await this.pc.getStats();
            let audioLevel = 0;

            stats.forEach((report: any) => {
                // For outbound audio (user's microphone)
                if (this.trackType === 'outbound' && report.type === 'media-source' && report.kind === 'audio') {
                    // media-source reports have audioLevel for local audio
                    if (typeof report.audioLevel === 'number') {
                        audioLevel = report.audioLevel;
                    }
                }

                // For inbound audio (agent's audio)
                if (this.trackType === 'inbound' && report.type === 'inbound-rtp' && report.kind === 'audio') {
                    // inbound-rtp reports have audioLevel for remote audio
                    if (typeof report.audioLevel === 'number') {
                        audioLevel = report.audioLevel;
                    }
                }

                // Alternative: check track stats which may have audioLevel
                if (report.type === 'track' && report.kind === 'audio') {
                    const isRemote = report.remoteSource === true;
                    if ((this.trackType === 'inbound' && isRemote) || 
                        (this.trackType === 'outbound' && !isRemote)) {
                        if (typeof report.audioLevel === 'number') {
                            audioLevel = report.audioLevel;
                        }
                    }
                }
            });

            // Emit the audio level (clamped to 0-1 range)
            this.onLevelChange(Math.max(0, Math.min(1, audioLevel)));
        } catch (error) {
            // Silently handle errors (connection might be closing)
            if (this.isRunning) {
                console.warn('[AudioLevelMonitor] Error polling audio level:', error);
            }
        }
    }

    /**
     * Check if the monitor is currently running
     */
    get running(): boolean {
        return this.isRunning;
    }
}
