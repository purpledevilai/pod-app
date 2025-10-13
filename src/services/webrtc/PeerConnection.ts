import { makeAutoObservable } from "mobx";
import {
    MediaStream,
    RTCPeerConnection
} from 'react-native-webrtc';

/**
 * PeerConnection - Manages a single WebRTC peer connection
 * Handles media streams and data channel communication
 */
export class PeerConnection {
    id: string;
    selfDescription: string;
    outboundMediaStream: MediaStream | undefined = undefined;
    pc: RTCPeerConnection | undefined = undefined;
    inboundMediaStream: MediaStream | undefined = undefined;
    createDataChannel: boolean = false;
    dataChannel: RTCDataChannel | undefined = undefined;
    onMessageCallback: ((message: string) => void) | undefined = undefined;
    onVolumeChangeCallback: ((volume: number) => void) | undefined = undefined;

    constructor(
        id: string,
        selfDescription: string,
        outboundMediaStream: MediaStream,
        createDataChannel: boolean = false,
    ) {
        makeAutoObservable(this);
        this.id = id;
        this.selfDescription = selfDescription;
        this.outboundMediaStream = outboundMediaStream;
        this.createDataChannel = createDataChannel;
    }

    setOnDataChannelMessage(callback: (message: string) => void) {
        this.onMessageCallback = callback;
    }

    setOnVolumeChange(callback: (volume: number) => void) {
        this.onVolumeChangeCallback = callback;
    }

    initialize() {
        // Create RTCPeerConnection with STUN/TURN servers
        this.pc = new RTCPeerConnection({
            iceServers: [
                {
                    urls: "stun:stun.relay.metered.ca:80",
                },
                {
                    urls: "turn:global.relay.metered.ca:80",
                    username: process.env.EXPO_PUBLIC_TURN_USERNAME || "854bc4758e20cfe78cf64c95",
                    credential: process.env.EXPO_PUBLIC_TURN_CREDENTIAL || "+KBw1GxPiZBSkrmt",
                },
                {
                    urls: "turn:global.relay.metered.ca:80?transport=tcp",
                    username: process.env.EXPO_PUBLIC_TURN_USERNAME || "854bc4758e20cfe78cf64c95",
                    credential: process.env.EXPO_PUBLIC_TURN_CREDENTIAL || "+KBw1GxPiZBSkrmt",
                },
                {
                    urls: "turn:global.relay.metered.ca:443",
                    username: process.env.EXPO_PUBLIC_TURN_USERNAME || "854bc4758e20cfe78cf64c95",
                    credential: process.env.EXPO_PUBLIC_TURN_CREDENTIAL || "+KBw1GxPiZBSkrmt",
                },
                {
                    urls: "turns:global.relay.metered.ca:443?transport=tcp",
                    username: process.env.EXPO_PUBLIC_TURN_USERNAME || "854bc4758e20cfe78cf64c95",
                    credential: process.env.EXPO_PUBLIC_TURN_CREDENTIAL || "+KBw1GxPiZBSkrmt",
                },
            ],
        });

        // ✅ If this peer is the initiator, create data channel
        if (this.createDataChannel) {
            this.dataChannel = this.pc.createDataChannel("chat");

            this.dataChannel.onopen = () => {
                console.log(`[${this.id}] DataChannel is open and ready`);
            };

            this.dataChannel.onmessage = (event: any) => {
                console.log(`[${this.id}] Received message:`, event.data);
                if (this.onMessageCallback) this.onMessageCallback(event.data);
            };
        }

        // ✅ If this peer is the answerer, listen for incoming data channels
        this.pc.ondatachannel = (event: any) => {
            console.log(`[${this.id}] Incoming data channel`);
            this.dataChannel = event.channel;

            this.dataChannel.onopen = () => {
                console.log(`[${this.id}] Incoming DataChannel is open`);
            };

            this.dataChannel.onmessage = (event: any) => {
                console.log(`[${this.id}] Received message from remote:`, event.data);
                if (this.onMessageCallback) this.onMessageCallback(event.data);
            };
        };

        // Handle incoming media tracks
        this.pc.ontrack = (event: any) => {
            console.log("Received Track Event:", event);
            const [newStream] = event.streams;
            this.inboundMediaStream = newStream;
            
            // TODO: Add audio monitoring for volume levels
            // This will be implemented in a later phase
            // For now, we'll just log when we receive a stream
            console.log(`[${this.id}] Inbound media stream received`);
        };

        // Add local media tracks (audio only for this app)
        this.outboundMediaStream?.getTracks().forEach((track) => {
            console.log("Adding local track:", track);
            this.pc?.addTrack(track, this.outboundMediaStream!);
        });
    }

    sendMessage(message: string) {
        if (this.dataChannel?.readyState === "open") {
            this.dataChannel.send(message);
            console.log(`[${this.id}] Sent message:`, message);
        } else {
            console.warn(`[${this.id}] Data channel not ready, state: ${this.dataChannel?.readyState}`);
        }
    }
}

