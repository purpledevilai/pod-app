/* eslint-disable */
import { makeAutoObservable } from "mobx";
import { MediaStream, RTCIceCandidate, RTCSessionDescription } from 'react-native-webrtc';
import { JSONRPCPeer } from "./JSONRPCPeer";
import { PeerConnection } from "./PeerConnection";

/**
 * RoomConnection - Manages WebSocket signaling and WebRTC peer connections for a room
 * Handles joining rooms, peer discovery, and connection negotiation
 */
export class RoomConnection {
    id: string;
    selfDescription: string;
    peerConnections: Record<string, PeerConnection>;
    roomServer: JSONRPCPeer | null = null;
    websocket: WebSocket | null = null;
    onPeerAdded: (peerId: string, selfDescription: string) => Promise<PeerConnection | null>;
    onConnectionRequest: (peerId: string, selfDescription: string) => Promise<PeerConnection | null>;
    onPeerConnectionStateChanged?: (peerId: string, connected: boolean) => void;
    defaultMediaStream: MediaStream | null;

    constructor({
        id,
        selfDescription = "Peer",
        onPeerAdded = this.defaultCreatePeer,
        onConnectionRequest = this.defaultCreatePeer,    
        defaultMediaStream = null,
        onPeerConnectionStateChanged = undefined
    }: {
        id: string;
        selfDescription?: string;
        onPeerAdded?: (peerId: string, selfDescription: string) => Promise<PeerConnection | null>;
        onConnectionRequest?: (peerId: string, selfDescription: string) => Promise<PeerConnection | null>;
        defaultMediaStream?: MediaStream | null;
        onPeerConnectionStateChanged?: (peerId: string, connected: boolean) => void;
    }) {
        makeAutoObservable(this);

        // Variables
        this.id = id;
        this.selfDescription = selfDescription;
        this.peerConnections = {};
        this.onPeerAdded = onPeerAdded || this.defaultCreatePeer;
        this.onConnectionRequest = onConnectionRequest || this.defaultCreatePeer;
        this.onPeerConnectionStateChanged = onPeerConnectionStateChanged;
        this.defaultMediaStream = defaultMediaStream;

        // Check that if there is no onPeerAdded that there must be a default media stream
        if ((!this.onPeerAdded || !this.onConnectionRequest) && !this.defaultMediaStream) {
            throw new Error("You must provide a default media stream if no onPeerAdded or onConnectionRequest is provided");
        }
        
    }

    // JOIN ROOM
    async joinRoom(): Promise<any> {
        return new Promise((resolve, reject) => {
            const signalingUrl = process.env.EXPO_PUBLIC_SIGNALING_SERVER_URL || 'ws://localhost:8080';
            console.log(`Connecting to signaling server: ${signalingUrl}/ws`);
            
            // Create WebSocket 
            this.websocket = new WebSocket(`${signalingUrl}/ws`);
    
            // Create sender for JSON-RPC messages
            const sender = (message: string) => {
                if (!this.websocket) {
                    throw new Error("WebSocket is not initialized");
                }
                this.websocket.send(message);
            };
    
            // Set up JSON-RPC peer
            this.roomServer = new JSONRPCPeer(sender);
            this.roomServer.on("peer_added", this.peer_added as (params: Record<string, any>) => any);
            this.roomServer.on("connection_request", this.connection_request as (params: Record<string, any>) => any);
            this.roomServer.on("add_ice_candidate", this.add_ice_candidate as (params: Record<string, any>) => any);
    
            // On Message
            this.websocket.onmessage = (event) => {
                if (!this.roomServer) {
                    throw new Error("RoomServer is not initialized");
                }
                this.roomServer.handleMessage(event.data);
            };
    
            // On Error
            this.websocket.onerror = (err) => {
                console.error("WebSocket error:", err);
                reject(err);
            };
    
            // On Close
            this.websocket.onclose = () => {
                console.log("WebSocket closed");
                for (const key in this.peerConnections) {
                    this.peerConnections[key].pc?.close();
                    delete this.peerConnections[key];
                }
            };
    
            // On Open
            this.websocket.onopen = async () => {
                console.log("WebSocket connected");
                try {
                    if (!this.roomServer) {
                        throw new Error("RoomServer is not initialized");
                    }
                    const existingPeers = await this.roomServer.call("join", {
                        room_id: this.id,
                        self_description: this.selfDescription
                    }, true);
                    console.log("Existing peers:", existingPeers);
                    resolve(existingPeers);
                } catch (err) {
                    console.error("Error joining room:", err);
                    reject(err);
                }
            };
        });
    }
    

    // DEFAULT PEER TO ADD
    private defaultCreatePeer = async (peerId: string, selfDescription: string) => {
        console.log("Default onPeerAdded called");
        const peerConnection = new PeerConnection(peerId, selfDescription, this.defaultMediaStream!);
        return peerConnection;
    }

    // CONFIGURE PEER
    private configurePeer = (peerConnection: PeerConnection) => {

        // Peer ID
        const peer_id = peerConnection.id;

        // Initialize peer connection
        peerConnection.initialize();

        if (!peerConnection.pc) {
            throw new Error("PeerConnection is not initialized");
        }

        // Set on ICE candidate
        (peerConnection.pc as any).onicecandidate = (event: any) => {
            if (event.candidate) {
                console.log("Relaying ICE candidate");
                if (!this.roomServer) {
                    throw new Error("RoomServer is not initialized");
                }
                this.roomServer.call("relay_ice_candidate", {
                    peer_id,
                    candidate: event.candidate,
                });
            }
        }

        // On ICE Connection State Change
        (peerConnection.pc as any).oniceconnectionstatechange = () => {
            console.log("ICE connection state changed:", (peerConnection.pc as any).iceConnectionState);
        }

        // On Connection State Change
        (peerConnection.pc as any).onconnectionstatechange = () => {

            if (!peerConnection.pc) {
                console.error("PeerConnection is not initialized");
                return;
            }

            console.log("Connection state changed:", (peerConnection.pc as any).connectionState);

            // If connection state changed is defined, call it
            if (this.onPeerConnectionStateChanged) {
                this.onPeerConnectionStateChanged(peer_id, (peerConnection.pc as any).connectionState === "connected");
            }

            // Check if connection is closed
            if ((peerConnection.pc as any).connectionState === "disconnected" || (peerConnection.pc as any).connectionState === "closed") {
                console.log("Peer connection closed");
                // Clean up peer connection
                peerConnection.pc.close();
                peerConnection.outboundMediaStream?.getTracks().forEach((track) => {
                    track.stop();
                });
                delete this.peerConnections[peer_id];
                console.log("Peer connection removed:", peer_id);
            }
        }
    }

    // PEER ADDED
    private peer_added = async (params: { peer_id: string; self_description: string }) => {
        console.log("Peer added:", params);
        const { peer_id, self_description } = params;

        // Ask domain logic if we want to connect to this peer
        const peerConnection = await this.onPeerAdded(peer_id, self_description);
        if (!peerConnection) {
            return; // Rejecting to connect to peer
        }

        // Configure peer connection
        this.configurePeer(peerConnection);

        // Check if pc is initialized
        if (!peerConnection.pc) {
            throw new Error("PeerConnection is not initialized");
        }
        
        // Create offer
        const offer = await peerConnection.pc.createOffer();
        await peerConnection.pc.setLocalDescription(offer);

        // Send offer to peer
        console.log("Calling request connection");
        if (!this.roomServer) {
            throw new Error("RoomServer is not initialized");
        }
        const answerResponse = await this.roomServer.call("request_connection", {
            peer_id,
            self_description: this.selfDescription,
            offer,
        }, true, 10000);

        // Check if we got an answer
        if (!answerResponse || !answerResponse.answer) {
            console.log("Connection rejected by peer");
            return; // Connection rejected
        }

        // Set answer
        await peerConnection.pc.setRemoteDescription(new RTCSessionDescription(answerResponse.answer as any));

        // Add peer connection to list
        this.peerConnections[peer_id] = peerConnection;
        console.log("Peer connection added:", peer_id);
    }

    // CONNECTION REQUEST
    private connection_request = async (params: { peer_id: string; self_description: string; offer: any }) => {
        console.log("Connection request:", params);
        const { peer_id, self_description, offer } = params;

        // Ask domain logic if we want to connect to this peer
        const peerConnection = await this.onConnectionRequest(peer_id, self_description);
        if (!peerConnection) {
            console.log("Connection request rejected");
            return null; // Rejecting to connect to peer
        }

        // Configure peer connection
        this.configurePeer(peerConnection);

        // Check if pc is initialized
        if (!peerConnection.pc) {
            throw new Error("PeerConnection is not initialized");
        }

        // Set remote and create answer
        await peerConnection.pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.pc.createAnswer();
        await peerConnection.pc.setLocalDescription(answer);

        // Add peer connection to list
        this.peerConnections[peer_id] = peerConnection;
        console.log("Peer connection added:", peer_id);

        // return answer
        console.log("Sending answer:", answer);
        return answer
    }

    // ADD ICE CANDIDATE
    private add_ice_candidate = async (params: { peer_id: string; candidate: any }) => {
        const { peer_id, candidate } = params;

        // Wait for peer connection to be created
        let timeElapsed = 0;
        const timeout = 10000; // 10 seconds
        const waitInterval = 100;
        while (!this.peerConnections[peer_id] && timeElapsed < timeout) {
            timeElapsed += waitInterval;
            await new Promise((resolve) => setTimeout(resolve, waitInterval));
        }

        // Add ICE candidate to peer connection
        const peer = this.peerConnections[peer_id];
        if (peer) {
            console.log("Adding ICE candidate:", params);
            await peer.pc?.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
            console.log("ICE Peer not found:", peer_id);
        }
    }

    //  LEAVE ROOM
    leaveRoom() {
        console.log("Leaving room:", this.id);
        // Close all peer connections
        Object.keys(this.peerConnections || {}).forEach((key) => {
            const peerConnection = this.peerConnections[key];
            peerConnection.pc?.close();
            peerConnection.outboundMediaStream?.getTracks().forEach((track) => {
                track.stop();
            });
            delete this.peerConnections[key];
            console.log("Peer connection closed:", key);
        });
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }
        this.peerConnections = {};
    }
}

