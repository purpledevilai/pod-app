import { AudioLevelMonitor } from "@/src/services/audio/AudioLevelMonitor";
import { JSONRPCPeer } from "@/src/services/webrtc/JSONRPCPeer";
import { PeerConnection } from "@/src/services/webrtc/PeerConnection";
import { RoomConnection } from "@/src/services/webrtc/RoomConnection";
import { makeAutoObservable, runInAction } from "mobx";
import InCallManager from 'react-native-incall-manager';
import { MediaStream } from 'react-native-webrtc';
import { AuthStore } from "./auth.store";
import { mediaDeviceStore } from "./mediadevice.store";

type BinSpec = { type: "kerbside" | "pod"; color: string };

const PER_BIN_MS = 6000;
const REWARD_PANEL_MS = 3000;

/**
 * The agent server delivers tool_output as a string built from Python's `str(dict)`
 * (single-quoted, e.g. `"{'new_total': 20}"`) rather than valid JSON. Accept either an
 * already-parsed object or a string in either JSON or Python-repr form, and return a
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
 * Coordinates WebRTC connections, media streams, and agent communication
 */
export class AgentRoomStore {
    roomConnection: RoomConnection | undefined = undefined;
    selectedAudioDevice: MediaDeviceInfo | undefined = undefined;
    mediaStream: MediaStream | undefined = undefined;
    audioMuted = false;
    
    // Connection states
    isConnecting = true;
    isConnected = false;
    isTranscriptionReady = false;
    isCalibrating = false;
    hasCalibrated = false;
    isReady = false;
    
    // Speech states
    isUserSpeaking = false;
    currentDetectedSpeech: string | undefined = undefined;
    
    // User messages (persistent history)
    userMessages: { text: string; message_id: string }[] = [];
    currentUserMessageId: string | undefined = undefined;
    private userMessageCounter = 0;
    
    // AI messages
    aiMessages: { sentence: string; sentence_id: string }[] = [];
    currentlySpeakingSentenceId: string | undefined = undefined;
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
    
    // RPC layer for agent communication
    agentRPCLayer: JSONRPCPeer | undefined = undefined;
    
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
        
        if (this.roomConnection) {
            this.roomConnection.leaveRoom();
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
        
        this.roomConnection = undefined;
        this.selectedAudioDevice = undefined;
        this.mediaStream = undefined;
        this.audioMuted = false;
        this.isConnecting = true;
        this.isConnected = false;
        this.isTranscriptionReady = false;
        this.isCalibrating = false;
        this.hasCalibrated = false;
        this.isReady = false;
        this.isUserSpeaking = false;
        this.currentDetectedSpeech = undefined;
        this.userMessages = [];
        this.currentUserMessageId = undefined;
        this.userMessageCounter = 0;
        this.aiMessages = [];
        this.currentlySpeakingSentenceId = undefined;
        this.agentRPCLayer = undefined;
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
     * Initializes media devices, sets up the room connection, and invites the agent
     * @param contextId The context ID to use as the room ID
     * @param clientApiKey Short-lived client API key for authenticating with Ajentify services
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

            // Create the room connection
            console.log('[AgentRoomStore] Creating room connection...');
            this.roomConnection = new RoomConnection({
                id: contextId,
                selfDescription: `User`,
                onPeerAdded: this.onPeerAdded,
                onConnectionRequest: this.onConnectionRequest,
                onPeerConnectionStateChanged: (peerId: string, connected: boolean) => {
                    console.log(`[AgentRoomStore] Peer ${peerId} connection status: ${connected}`);
                    runInAction(() => {
                        this.isConnected = connected;
                        this.isConnecting = !connected;
                    });
                }
            });

            // Join the room
            console.log('[AgentRoomStore] Joining room...');
            const existingPeers = await this.roomConnection.joinRoom();
            console.log('[AgentRoomStore] Joined room, existing peers:', existingPeers);

            // Check if the room has an agent
            const hasAgent = existingPeers["existing_peers"]?.some(
                (peer: { self_description: string }) => peer.self_description === "Agent"
            );

            if (!hasAgent) {
                console.log('[AgentRoomStore] No agent found, inviting agent...');
                await this.inviteAgent(contextId, clientApiKey);
            } else {
                console.log('[AgentRoomStore] Agent already in room');
            }
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
     * Invite the agent to join the room
     */
    private async inviteAgent(contextId: string, clientApiKey: string) {
        try {
            console.log('[AgentRoomStore] Calling agent server to invite agent...');
            const agentServerUrl = process.env.EXPO_PUBLIC_AGENT_SERVER_URL || 'http://localhost:8000';
            const response = await fetch(
                `${agentServerUrl}/invite-agent`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": clientApiKey,
                    },
                    body: JSON.stringify({
                        context_id: contextId,
                    }),
                }
            );
            
            if (!response.ok) {
                throw new Error(`Failed to invite agent: ${response.status}`);
            }
            
            console.log('[AgentRoomStore] Agent invited successfully');
        } catch (error) {
            console.error('[AgentRoomStore] Error inviting agent:', error);
            throw error;
        }
    }

    /**
     * Called when a new peer is added to the room (initiator side)
     */
    onPeerAdded = async (peerId: string, selfDescription: string) => {
        console.log(`[AgentRoomStore] Peer added: ${peerId} (${selfDescription})`);
        
        if (selfDescription === "Agent") {
            // If the peer is an agent, we create a data channel
            return await this.onPeerAddedOrConnectionRequest(peerId, selfDescription, true);
        }
        return await this.onPeerAddedOrConnectionRequest(peerId, selfDescription, false);
    }

    /**
     * Called when a connection request is received (answerer side)
     */
    onConnectionRequest = async (peerId: string, selfDescription: string) => {
        console.log(`[AgentRoomStore] Connection request: ${peerId} (${selfDescription})`);
        return await this.onPeerAddedOrConnectionRequest(peerId, selfDescription, false);
    }

    /**
     * Peer added or connection request handler
     * Creates PeerConnection and sets up agent communication
     */
    onPeerAddedOrConnectionRequest = async (
        peerId: string, 
        selfDescription: string, 
        createDataChannel: boolean
    ) => {
        console.log(`[AgentRoomStore] Setting up peer connection for ${peerId}...`);

        // Get media stream (audio only)
        const audioConstraints = this.selectedAudioDevice
            ? { deviceId: this.selectedAudioDevice.deviceId }
            : true;

        const mediaStream = await mediaDeviceStore.getMediaStream(
            typeof audioConstraints === 'object' ? audioConstraints.deviceId : undefined
        );
        
        // Create peer connection
        const peer = new PeerConnection(peerId, selfDescription, mediaStream, createDataChannel);
        
        // Set up callback for when inbound stream is received (for agent audio monitoring)
        peer.setOnInboundStreamReceived(() => {
            // Start agent audio monitor when we receive the inbound stream
            if (peer.pc && !this.agentAudioMonitor) {
                console.log('[AgentRoomStore] Starting agent audio level monitor');
                this.agentAudioMonitor = new AudioLevelMonitor({
                    peerConnection: peer.pc,
                    trackType: 'inbound',
                    onLevelChange: (level) => {
                        this.onAgentAudioLevel?.(level);
                    },
                    pollIntervalMs: 100,
                });
                this.agentAudioMonitor.start();
            }
        });
        
        // Set up JSON-RPC layer for agent communication
        this.agentRPCLayer = new JSONRPCPeer(peer.sendMessage);
        this.setupAgentCallbacks(peerId);
        
        // Set the data channel message handler
        peer.setOnDataChannelMessage(this.agentRPCLayer.handleMessage);
        
        // Start user audio monitor after peer is initialized (will have access to pc)
        // We need to defer this until after the peer connection is configured
        setTimeout(() => {
            if (peer.pc && !this.userAudioMonitor) {
                console.log('[AgentRoomStore] Starting user audio level monitor');
                this.userAudioMonitor = new AudioLevelMonitor({
                    peerConnection: peer.pc,
                    trackType: 'outbound',
                    onLevelChange: (level) => {
                        this.onUserAudioLevel?.(level);
                    },
                    pollIntervalMs: 100,
                });
                this.userAudioMonitor.start();
            }
        }, 100);
        
        console.log(`[AgentRoomStore] Peer connection setup complete for ${peerId}`);
        return peer;
    }

    /**
     * Set up callbacks for agent communication via RPC
     */
    private setupAgentCallbacks(peerId: string) {
        if (!this.agentRPCLayer) return;

        this.agentRPCLayer.on("data_channel_connection_status", ({status}) => {
            console.log(`[AgentRoomStore] Data channel status: ${status}`);
            runInAction(() => {
                this.isConnected = status === "connected";
            });
        });

        this.agentRPCLayer.on("calibration_status", ({status}) => {
            console.log(`[AgentRoomStore] Calibration status: ${status}`);
            runInAction(() => {
                this.isCalibrating = status === "started";
                this.hasCalibrated = status === "complete";
            });
        });

        this.agentRPCLayer.on("agent_status", ({status}) => {
            console.log(`[AgentRoomStore] Agent status: ${status}`);
            runInAction(() => {
                if (status === "waking_up") {
                    this.isTranscriptionReady = false;
                } else if (status === "calibrating") {
                    this.isTranscriptionReady = true;
                } else if (status === "ready") {
                    this.isReady = true;
                }
            });
        });

        this.agentRPCLayer.on("is_speaking_status", ({is_speaking}) => {
            console.log(`[AgentRoomStore] User speaking: ${is_speaking}`);
            runInAction(() => {
                this.isUserSpeaking = is_speaking;
                
                if (is_speaking) {
                    // User started speaking - create a new message entry if we don't have one already
                    // (speech_detected might have already created one)
                    if (!this.currentUserMessageId) {
                        this.userMessageCounter++;
                        const newMessageId = `user-msg-${this.userMessageCounter}`;
                        this.currentUserMessageId = newMessageId;
                        this.userMessages.push({ text: '', message_id: newMessageId });
                    }
                } else {
                    // User stopped speaking - finalize the message
                    // Clear active indicators but keep the message in history
                    this.currentDetectedSpeech = undefined;
                    this.currentUserMessageId = undefined;
                }
            });
        });

        this.agentRPCLayer.on("speech_detected", ({text}) => {
            console.log(`[AgentRoomStore] Speech detected: ${text}`);
            runInAction(() => {
                this.currentDetectedSpeech = text;
                
                // If we don't have a current message yet (speech_detected came before is_speaking_status),
                // create one now
                if (!this.currentUserMessageId) {
                    this.userMessageCounter++;
                    const newMessageId = `user-msg-${this.userMessageCounter}`;
                    this.currentUserMessageId = newMessageId;
                    this.userMessages.push({ text: text, message_id: newMessageId });
                } else {
                    // Update the current user message in the history
                    const currentMsg = this.userMessages.find(
                        m => m.message_id === this.currentUserMessageId
                    );
                    if (currentMsg) {
                        currentMsg.text = text;
                    }
                }
            });
        });

        this.agentRPCLayer.on("ai_sentence", ({sentence, sentence_id}) => {
            console.log(`[AgentRoomStore] AI sentence: ${sentence} (${sentence_id})`);
            runInAction(() => {
                this.aiMessages.push({ sentence, sentence_id });
                this.showAIMessages = true;
            });
        });

        this.agentRPCLayer.on("is_speaking_sentence", ({sentence_id}) => {
            console.log(`[AgentRoomStore] AI speaking sentence: ${sentence_id}`);
            runInAction(() => {
                this.currentlySpeakingSentenceId = sentence_id;
            });
        });

        this.agentRPCLayer.on("stoped_speaking", () => {
            console.log(`[AgentRoomStore] AI stopped speaking`);
            runInAction(() => {
                // Only clear the active speaking indicator, keep all messages persistent
                this.currentlySpeakingSentenceId = undefined;
                // Keep showAIMessages true since we want to persistently show messages
            });
        });

        this.agentRPCLayer.on("tool_call", ({tool_name, tool_input}) => {
            console.log(`[AgentRoomStore] Tool called: ${tool_name}`, tool_input);
            this.agentToolCallHandler(tool_name, tool_input);
        });

        this.agentRPCLayer.on("tool_response", ({tool_name, tool_output}) => {
            console.log(`[AgentRoomStore] Tool response: ${tool_name}`, tool_output);
            this.agentToolResponseHandler(tool_name, tool_output);
        });
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
    
        // Toggle local stream audio tracks
        const audioTracks = this.mediaStream.getAudioTracks();
        if (audioTracks.length > 0) {
            const track = audioTracks[0];
            const newEnabledState = !track.enabled;
            track.enabled = newEnabledState;
            
            runInAction(() => {
                this.audioMuted = !newEnabledState;
            });
            
            console.log(`[AgentRoomStore] Microphone ${newEnabledState ? 'unmuted' : 'muted'}`);
    
            // Also update all outbound tracks in peer connections
            if (this.roomConnection) {
                Object.values(this.roomConnection.peerConnections).forEach((peerConn) => {
                    const outboundStream = peerConn.outboundMediaStream;
                    if (!outboundStream) return;
    
                    const peerAudioTracks = outboundStream.getAudioTracks();
                    peerAudioTracks.forEach((peerTrack) => {
                        peerTrack.enabled = newEnabledState;
                    });
                });
            }
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

