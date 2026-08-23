import { AudioLevelMonitor } from "@/src/services/audio/AudioLevelMonitor";
import { RealtimeConnection } from "@/src/services/webrtc/RealtimeConnection";
import { makeAutoObservable, runInAction } from "mobx";
import InCallManager from 'react-native-incall-manager';
import { MediaStream } from 'react-native-webrtc';
import { AuthStore } from "./auth.store";
import { mediaDeviceStore } from "./mediadevice.store";

type BinSpec = { type: "kerbside" | "pod"; color: string };

const PER_BIN_MS = 6000;
const REWARD_PANEL_MS = 3000;

/**
 * The realtime server delivers tool_output as the tool's raw return, which may be
 * a plain object, a JSON string, or (from the legacy pipeline) a Python-repr string
 * (single-quoted, e.g. `"{'new_total': 20}"`). Accept any of these and return a
 * plain object — or undefined if we couldn't make sense of it.
 */
function parseToolOutput(raw: any): Record<string, any> | undefined {
    if (raw == null) return undefined;
    if (typeof raw === "object") return raw;
    if (typeof raw !== "string") return undefined;

    try {
        return JSON.parse(raw);
    } catch {}
    try {
        // Cheap Python-repr -> JSON: swap single quotes for double, normalise booleans/None.
        const jsonish = raw
            .replace(/'/g, '"')
            .replace(/\bTrue\b/g, "true")
            .replace(/\bFalse\b/g, "false")
            .replace(/\bNone\b/g, "null");
        return JSON.parse(jsonish);
    } catch {
        return undefined;
    }
}

/**
 * AgentRoomStore - Main store for managing the voice conversation with the AI agent
 * Coordinates the realtime WebRTC connection, media streams, and agent events.
 */
export class AgentRoomStore {
    realtimeConnection: RealtimeConnection | undefined = undefined;
    selectedAudioDevice: MediaDeviceInfo | undefined = undefined;
    mediaStream: MediaStream | undefined = undefined;
    audioMuted = false;

    // Connection states
    isConnecting = true;
    isConnected = false;
    isReady = false;

    // User messages (final transcripts, append-only history)
    userMessages: { text: string; message_id: string }[] = [];

    // AI messages (final transcripts, append-only history)
    aiMessages: { text: string; message_id: string }[] = [];
    showAIMessages = true;

    // Slide-up view for agent events
    slideUpViewShouldShow = false;
    slideUpViewContentType: string | undefined = undefined;

    // Bin classification view (queue of bins, animated one after another)
    binClassificationShouldShow = false;
    binClassificationQueue: BinSpec[] = [];
    binClassificationIndex = 0;
    private binClassificationAdvanceTimer: ReturnType<typeof setTimeout> | undefined = undefined;

    // Reward panel (shown after the bin queue finishes when show_reward + points > 0)
    rewardPanelShouldShow = false;
    rewardPanelPoints: number | undefined = undefined;
    private rewardPanelHideTimer: ReturnType<typeof setTimeout> | undefined = undefined;
    private pendingShowReward = false;
    private pendingRewardPoints = 0;

    // Audio level monitoring
    private userAudioMonitor: AudioLevelMonitor | undefined = undefined;
    private agentAudioMonitor: AudioLevelMonitor | undefined = undefined;

    // Audio level callbacks (for orb animation)
    onUserAudioLevel: ((level: number) => void) | undefined = undefined;
    onAgentAudioLevel: ((level: number) => void) | undefined = undefined;

    // Error handling
    initializationError: string | undefined = undefined;

    private authStore: AuthStore;

    constructor(authStore: AuthStore) {
        this.authStore = authStore;
        makeAutoObservable(this);
    }

    get currentBinColor(): string | undefined {
        return this.binClassificationQueue[this.binClassificationIndex]?.color;
    }

    get currentBinType(): "kerbside" | "pod" | undefined {
        return this.binClassificationQueue[this.binClassificationIndex]?.type;
    }

    /**
     * Reset the store to initial state
     */
    reset = () => {
        console.log('[AgentRoomStore] Resetting store...');

        if (this.realtimeConnection) {
            this.realtimeConnection.close();
        }

        // Stop audio monitors
        if (this.userAudioMonitor) {
            this.userAudioMonitor.stop();
            this.userAudioMonitor = undefined;
        }
        if (this.agentAudioMonitor) {
            this.agentAudioMonitor.stop();
            this.agentAudioMonitor = undefined;
        }

        // Stop media tracks
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach((track) => track.stop());
        }

        this.realtimeConnection = undefined;
        this.selectedAudioDevice = undefined;
        this.mediaStream = undefined;
        this.audioMuted = false;
        this.isConnecting = true;
        this.isConnected = false;
        this.isReady = false;
        this.userMessages = [];
        this.aiMessages = [];
        this.showAIMessages = true;
        this.slideUpViewShouldShow = false;
        this.slideUpViewContentType = undefined;
        this.binClassificationShouldShow = false;
        this.binClassificationQueue = [];
        this.binClassificationIndex = 0;
        if (this.binClassificationAdvanceTimer) {
            clearTimeout(this.binClassificationAdvanceTimer);
            this.binClassificationAdvanceTimer = undefined;
        }
        this.rewardPanelShouldShow = false;
        this.rewardPanelPoints = undefined;
        if (this.rewardPanelHideTimer) {
            clearTimeout(this.rewardPanelHideTimer);
            this.rewardPanelHideTimer = undefined;
        }
        this.pendingShowReward = false;
        this.pendingRewardPoints = 0;
        this.initializationError = undefined;

        console.log('[AgentRoomStore] Reset complete');
    }

    /**
     * Set callback for user audio level changes (for animation)
     */
    setOnUserAudioLevel(callback: (level: number) => void) {
        this.onUserAudioLevel = callback;
    }

    /**
     * Set callback for agent audio level changes (for animation)
     */
    setOnAgentAudioLevel(callback: (level: number) => void) {
        this.onAgentAudioLevel = callback;
    }

    /**
     * Initializes media devices and opens the realtime connection to the
     * TokenStreamingServer `/ws-realtime` endpoint.
     * @param contextId The Ajentify context ID for this session
     * @param clientApiKey Short-lived, client-scoped API key used as the access token
     */
    async initialize(contextId: string, clientApiKey: string) {
        try {
            console.log('[AgentRoomStore] Starting initialization with context:', contextId);
            runInAction(() => {
                this.isConnecting = true;
                this.initializationError = undefined;
            });

            // Initialize media devices - asks for permission if not granted
            console.log('[AgentRoomStore] Initializing media devices...');
            await mediaDeviceStore.initializeMediaDevices();
            console.log('[AgentRoomStore] Media devices initialized');

            // Set default selected devices
            runInAction(() => {
                this.selectedAudioDevice = mediaDeviceStore.audioDevices[0];
            });

            // Get audio stream
            console.log('[AgentRoomStore] Getting media stream...');
            this.mediaStream = await mediaDeviceStore.getMediaStream(
                this.selectedAudioDevice?.deviceId
            );
            console.log('[AgentRoomStore] Media stream obtained');

            // Set audio output to speaker (not earpiece)
            try {
                InCallManager.start({ media: 'audio', ringback: '' });
                InCallManager.setForceSpeakerphoneOn(true);
                console.log('[AgentRoomStore] Speakerphone enabled via InCallManager');
            } catch (error) {
                console.warn('[AgentRoomStore] Could not enable speakerphone:', error);
            }

            // Create the realtime connection
            console.log('[AgentRoomStore] Creating realtime connection...');
            this.realtimeConnection = new RealtimeConnection({
                contextId,
                accessToken: clientApiKey,
                mediaStream: this.mediaStream,
                onConnectionStateChanged: (connected) => {
                    console.log(`[AgentRoomStore] Realtime connection status: ${connected}`);
                    runInAction(() => {
                        this.isConnected = connected;
                        this.isConnecting = !connected;
                    });
                },
                onInboundStreamReceived: () => {
                    this.startAgentAudioMonitor();
                },
                onToolCall: ({ tool_name, tool_input }) => {
                    console.log(`[AgentRoomStore] Tool called: ${tool_name}`, tool_input);
                    this.agentToolCallHandler(tool_name, tool_input);
                },
                onToolResponse: ({ tool_name, tool_output }) => {
                    console.log(`[AgentRoomStore] Tool response: ${tool_name}`, tool_output);
                    this.agentToolResponseHandler(tool_name, tool_output);
                },
                onUserTranscript: ({ transcript }) => {
                    console.log(`[AgentRoomStore] User transcript: ${transcript}`);
                    runInAction(() => {
                        this.userMessages.push({
                            text: transcript,
                            message_id: `user-${Date.now()}`,
                        });
                    });
                },
                onAgentTranscript: ({ transcript }) => {
                    console.log(`[AgentRoomStore] Agent transcript: ${transcript}`);
                    runInAction(() => {
                        this.aiMessages.push({
                            text: transcript,
                            message_id: `ai-${Date.now()}`,
                        });
                        this.showAIMessages = true;
                    });
                },
                onClientSideToolCalls: (params) => {
                    console.log('[AgentRoomStore] Client-side tool calls (unused by pod):', params);
                },
            });

            // Open the WebSocket + WebRTC session and complete the handshake
            console.log('[AgentRoomStore] Connecting realtime session...');
            await this.realtimeConnection.connect();
            console.log('[AgentRoomStore] Realtime session connected');

            runInAction(() => {
                this.isReady = true;
                this.isConnected = true;
                this.isConnecting = false;
            });

            // Start the user audio level monitor off the peer connection
            this.startUserAudioMonitor();
        } catch (error) {
            console.error('[AgentRoomStore] Initialization error:', error);
            runInAction(() => {
                this.initializationError = error instanceof Error ? error.message : 'Failed to initialize';
                this.isConnecting = false;
            });
            throw error;
        }
    }

    /**
     * Start monitoring the agent's inbound audio level (for the orb animation).
     */
    private startAgentAudioMonitor() {
        const pc = this.realtimeConnection?.peerConnection;
        if (pc && !this.agentAudioMonitor) {
            console.log('[AgentRoomStore] Starting agent audio level monitor');
            this.agentAudioMonitor = new AudioLevelMonitor({
                peerConnection: pc,
                trackType: 'inbound',
                onLevelChange: (level) => {
                    this.onAgentAudioLevel?.(level);
                },
                pollIntervalMs: 100,
            });
            this.agentAudioMonitor.start();
        }
    }

    /**
     * Start monitoring the user's outbound audio level (for the orb animation).
     */
    private startUserAudioMonitor() {
        const pc = this.realtimeConnection?.peerConnection;
        if (pc && !this.userAudioMonitor) {
            console.log('[AgentRoomStore] Starting user audio level monitor');
            this.userAudioMonitor = new AudioLevelMonitor({
                peerConnection: pc,
                trackType: 'outbound',
                onLevelChange: (level) => {
                    this.onUserAudioLevel?.(level);
                },
                pollIntervalMs: 100,
            });
            this.userAudioMonitor.start();
        }
    }

    /**
     * Handle tool calls from the agent
     * Routes UI triggers based on the tool name
     */
    private agentToolCallHandler(tool_name: string, tool_input: any) {
        console.log(`[AgentRoomStore] Processing tool call: ${tool_name}`);

        switch(tool_name) {
            case "show_arl_and_ric":
                // Show the Australian Recycling Label and RIC (Resin Identification Code)
                runInAction(() => {
                    this.slideUpViewContentType = "arl_and_ric";
                    this.slideUpViewShouldShow = true;
                });
                break;

            case "show_bin": {
                const rawBins = Array.isArray(tool_input?.bins) ? tool_input.bins : [];
                const queue: BinSpec[] = rawBins.map((b: any) => ({
                    type: (b?.type === "pod" ? "pod" : "kerbside") as "kerbside" | "pod",
                    color: typeof b?.color === "string" ? b.color.toLowerCase() : "",
                }));

                const showReward = !!tool_input?.show_reward;
                const points = Number(tool_input?.points) || 0;

                runInAction(() => {
                    this.slideUpViewShouldShow = false;
                    this.clearBinAndRewardTimers();
                    this.rewardPanelShouldShow = false;
                    this.rewardPanelPoints = undefined;

                    this.pendingShowReward = showReward;
                    this.pendingRewardPoints = points;

                    if (queue.length === 0) {
                        this.binClassificationQueue = [];
                        this.binClassificationIndex = 0;
                        this.binClassificationShouldShow = false;
                        // No bins to show; if a reward is somehow pending, fire the reward panel directly.
                        if (showReward && points > 0) {
                            this.showRewardPanel();
                        }
                        return;
                    }

                    this.binClassificationQueue = queue;
                    this.binClassificationIndex = 0;
                    this.binClassificationShouldShow = true;
                    this.scheduleNextBinAdvance();
                });
                break;
            }

            // Add more tool names here as needed
            default:
                console.log(`[AgentRoomStore] Unknown tool name: ${tool_name}`);
        }
    }

    /**
     * Handle tool responses from the agent.
     * For show_bin we keep the user's points total in sync with the authoritative value
     * returned by the backend (new_total).
     */
    private agentToolResponseHandler(tool_name: string, tool_output: any) {
        if (tool_name !== "show_bin") return;

        const parsed = parseToolOutput(tool_output);
        const newTotal = parsed?.new_total;
        if (typeof newTotal !== "number") return;

        runInAction(() => {
            if (this.authStore.user) {
                this.authStore.user.points = newTotal;
            }
        });
    }

    /**
     * Schedule the timer that advances to the next bin in the queue (or, when the queue
     * is exhausted, hands off to the reward panel).
     */
    private scheduleNextBinAdvance() {
        if (this.binClassificationAdvanceTimer) {
            clearTimeout(this.binClassificationAdvanceTimer);
        }
        this.binClassificationAdvanceTimer = setTimeout(() => {
            runInAction(() => {
                this.binClassificationAdvanceTimer = undefined;
                const nextIndex = this.binClassificationIndex + 1;
                if (nextIndex < this.binClassificationQueue.length) {
                    this.binClassificationIndex = nextIndex;
                    this.scheduleNextBinAdvance();
                } else {
                    this.finishBinSequence();
                }
            });
        }, PER_BIN_MS);
    }

    /**
     * End-of-queue handler: hide the bin classification view, then conditionally show
     * the reward panel.
     */
    private finishBinSequence() {
        this.binClassificationShouldShow = false;
        this.binClassificationQueue = [];
        this.binClassificationIndex = 0;

        if (this.pendingShowReward && this.pendingRewardPoints > 0) {
            this.showRewardPanel();
        }
    }

    private showRewardPanel() {
        this.rewardPanelPoints = this.pendingRewardPoints;
        this.rewardPanelShouldShow = true;

        if (this.rewardPanelHideTimer) {
            clearTimeout(this.rewardPanelHideTimer);
        }
        this.rewardPanelHideTimer = setTimeout(() => {
            runInAction(() => {
                this.rewardPanelShouldShow = false;
                this.rewardPanelPoints = undefined;
                this.rewardPanelHideTimer = undefined;
                this.pendingShowReward = false;
                this.pendingRewardPoints = 0;
            });
        }, REWARD_PANEL_MS);
    }

    private clearBinAndRewardTimers() {
        if (this.binClassificationAdvanceTimer) {
            clearTimeout(this.binClassificationAdvanceTimer);
            this.binClassificationAdvanceTimer = undefined;
        }
        if (this.rewardPanelHideTimer) {
            clearTimeout(this.rewardPanelHideTimer);
            this.rewardPanelHideTimer = undefined;
        }
    }

    /**
     * Dismiss whichever in-call overlay is currently shown (bin sequence or reward panel)
     * and clear all related timers/state.
     */
    dismissActiveOverlay = () => {
        console.log('[AgentRoomStore] Dismissing active overlay');
        runInAction(() => {
            this.clearBinAndRewardTimers();
            this.binClassificationShouldShow = false;
            this.binClassificationQueue = [];
            this.binClassificationIndex = 0;
            this.rewardPanelShouldShow = false;
            this.rewardPanelPoints = undefined;
            this.pendingShowReward = false;
            this.pendingRewardPoints = 0;
        });
    }

    /**
     * Toggle speakerphone on/off
     */
    toggleSpeakerphone(enabled: boolean) {
        console.log(`[AgentRoomStore] Setting speakerphone: ${enabled}`);
        try {
            InCallManager.setForceSpeakerphoneOn(enabled);
        } catch (error) {
            console.warn('[AgentRoomStore] Could not toggle speakerphone:', error);
        }
    }

    /**
     * Toggle microphone mute
     */
    toggleMicrophone() {
        console.log('[AgentRoomStore] Toggling microphone');

        if (!this.mediaStream) {
            console.warn('[AgentRoomStore] No media stream available');
            return;
        }

        // Toggle local stream audio tracks. These are the same track objects added
        // to the single peer connection, so toggling here mutes the outbound audio.
        const audioTracks = this.mediaStream.getAudioTracks();
        if (audioTracks.length > 0) {
            const track = audioTracks[0];
            const newEnabledState = !track.enabled;
            audioTracks.forEach((t) => {
                t.enabled = newEnabledState;
            });

            runInAction(() => {
                this.audioMuted = !newEnabledState;
            });

            console.log(`[AgentRoomStore] Microphone ${newEnabledState ? 'unmuted' : 'muted'}`);
        }
    }

    /**
     * Leave the room and clean up resources
     */
    leaveRoom() {
        console.log('[AgentRoomStore] Leaving room...');

        // Stop audio monitors
        if (this.userAudioMonitor) {
            this.userAudioMonitor.stop();
        }
        if (this.agentAudioMonitor) {
            this.agentAudioMonitor.stop();
        }

        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach((track) => track.stop());
        }

        // Stop InCallManager
        try {
            InCallManager.stop();
            console.log('[AgentRoomStore] InCallManager stopped');
        } catch (error) {
            console.warn('[AgentRoomStore] Error stopping InCallManager:', error);
        }

        mediaDeviceStore.cleanup();
        this.reset();
    }
}
