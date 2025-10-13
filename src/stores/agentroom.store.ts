import { JSONRPCPeer } from "@/src/services/webrtc/JSONRPCPeer";
import { PeerConnection } from "@/src/services/webrtc/PeerConnection";
import { RoomConnection } from "@/src/services/webrtc/RoomConnection";
import { makeAutoObservable, runInAction } from "mobx";
import InCallManager from 'react-native-incall-manager';
import { MediaStream } from 'react-native-webrtc';
import { mediaDeviceStore } from "./mediadevice.store";

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
    isCalibrating = false;
    
    // Speech states
    isUserSpeaking = false;
    currentDetectedSpeech: string | undefined = undefined;
    
    // AI messages
    aiMessages: { sentence: string; sentence_id: string }[] = [];
    currentlySpeakingSentenceId: string | undefined = undefined;
    showAIMessages = true;
    
    // RPC layer for agent communication
    agentRPCLayer: JSONRPCPeer | undefined = undefined;
    
    // Volume monitoring callbacks (for future orb animation)
    onLocalVolumeChange: ((volume: number) => void) | undefined = undefined;
    onInboundVolumeChange: ((peerId: string, volume: number) => void) | undefined = undefined;

    // Error handling
    initializationError: string | undefined = undefined;

    constructor() {
        makeAutoObservable(this);
    }

    /**
     * Reset the store to initial state
     */
    reset = () => {
        console.log('[AgentRoomStore] Resetting store...');
        
        if (this.roomConnection) {
            this.roomConnection.leaveRoom();
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
        this.isCalibrating = false;
        this.isUserSpeaking = false;
        this.currentDetectedSpeech = undefined;
        this.aiMessages = [];
        this.currentlySpeakingSentenceId = undefined;
        this.agentRPCLayer = undefined;
        this.showAIMessages = true;
        this.initializationError = undefined;
        
        console.log('[AgentRoomStore] Reset complete');
    }

    setOnLocalVolumeChange(callback: (volume: number) => void) {
        this.onLocalVolumeChange = callback;
    }

    setOnInboundVolumeChange(callback: (peerId: string, volume: number) => void) {
        this.onInboundVolumeChange = callback;
    }

    /**
     * Initializes media devices, sets up the room connection, and invites the agent
     * @param contextId The context ID to use as the room ID
     */
    async initialize(contextId: string) {
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
                await this.inviteAgent(contextId);
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
    private async inviteAgent(contextId: string) {
        try {
            console.log('[AgentRoomStore] Calling agent server to invite agent...');
            const agentServerUrl = process.env.EXPO_PUBLIC_AGENT_SERVER_URL || 'http://localhost:8000';
            const response = await fetch(
                `${agentServerUrl}/invite-agent`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
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

        // TODO: Monitor local audio for volume (future phase)
        // monitorMicStream(mediaStream, (volume) => {
        //     this.onLocalVolumeChange?.(volume);
        // });
        
        // Create peer connection
        const peer = new PeerConnection(peerId, selfDescription, mediaStream, createDataChannel);
        
        // TODO: Monitor remote audio for volume (future phase)
        // peer.setOnVolumeChange((volume) => {
        //     this.onInboundVolumeChange?.(peerId, volume);
        // });
        
        // Set up JSON-RPC layer for agent communication
        this.agentRPCLayer = new JSONRPCPeer(peer.sendMessage);
        this.setupAgentCallbacks(peerId);
        
        // Set the data channel message handler
        peer.setOnDataChannelMessage(this.agentRPCLayer.handleMessage);
        
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
            });
        });

        this.agentRPCLayer.on("is_speaking_status", ({is_speaking}) => {
            console.log(`[AgentRoomStore] User speaking: ${is_speaking}`);
            runInAction(() => {
                this.isUserSpeaking = is_speaking;
            });
        });

        this.agentRPCLayer.on("speech_detected", ({text}) => {
            console.log(`[AgentRoomStore] Speech detected: ${text}`);
            runInAction(() => {
                this.currentDetectedSpeech = text;
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
                this.currentlySpeakingSentenceId = undefined;
                this.currentDetectedSpeech = undefined;
                this.showAIMessages = false;
            });
            
            // Clear AI messages after a delay
            setTimeout(() => {
                runInAction(() => {
                    this.aiMessages = [];
                });
            }, 2000);
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

