/* eslint-disable */
import {
    MediaStream,
    RTCPeerConnection,
    RTCSessionDescription,
} from 'react-native-webrtc';
import { JSONRPCPeer } from "./JSONRPCPeer";

export interface ToolCallParams {
    tool_call_id: string;
    tool_name: string;
    tool_input: any;
}

export interface ToolResponseParams {
    tool_call_id: string;
    tool_name: string;
    tool_output: any;
}

export interface ClientSideToolCallsParams {
    tool_calls: ToolCallParams[];
}

export interface TranscriptParams {
    transcript: string;
}

export interface RealtimeConnectionOptions {
    contextId: string;
    accessToken: string;
    mediaStream: MediaStream;
    onConnectionStateChanged?: (connected: boolean) => void;
    onInboundStreamReceived?: (stream: MediaStream) => void;
    // Realtime event callbacks (server -> client notifications; never reply)
    onToolCall?: (params: ToolCallParams) => void;
    onToolResponse?: (params: ToolResponseParams) => void;
    onUserTranscript?: (params: TranscriptParams) => void;
    onAgentTranscript?: (params: TranscriptParams) => void;
    onClientSideToolCalls?: (params: ClientSideToolCallsParams) => void;
}

export interface RealtimeConnectResult {
    success: boolean;
    model: string;
    voice: string;
    agent: any;
}

const ICE_GATHERING_TIMEOUT_MS = 3000;
const CONNECT_TIMEOUT_MS = 15000;

/**
 * RealtimeConnection - Owns the TokenStreamingServer `/ws-realtime` WebSocket,
 * the WebRTC peer connection to OpenAI, the one-shot `connect_to_realtime_context`
 * handshake, and inbound realtime event dispatch.
 *
 * The WebSocket carries JSON-RPC signaling AND all agent events. Audio flows
 * peer-to-peer between the client and OpenAI (the TSS is not in the audio path).
 */
export class RealtimeConnection {
    private opts: RealtimeConnectionOptions;
    private websocket: WebSocket | null = null;
    private rpc: JSONRPCPeer | null = null;
    private pc: RTCPeerConnection | undefined = undefined;
    private _inboundMediaStream: MediaStream | undefined = undefined;
    private closed = false;
    // Ensures we only tell the server we're ready once (the greeting trigger).
    private clientReadySent = false;

    constructor(opts: RealtimeConnectionOptions) {
        this.opts = opts;
    }

    get peerConnection(): RTCPeerConnection | undefined {
        return this.pc;
    }

    get inboundMediaStream(): MediaStream | undefined {
        return this._inboundMediaStream;
    }

    /**
     * Open the WebSocket, build the peer connection, complete the SDP handshake,
     * and start the audio session. Resolves once `setRemoteDescription` is applied.
     */
    async connect(): Promise<RealtimeConnectResult> {
        await this.openWebSocket();
        this.buildPeerConnection();

        // Create the offer and wait for ICE gathering (non-trickle: the TSS
        // handshake is one-shot with no ICE relay path).
        const offer = await this.pc!.createOffer({});
        await this.pc!.setLocalDescription(offer);
        const sdpOffer = await this.waitForIceGatheringComplete();

        const result = (await this.rpc!.call(
            "connect_to_realtime_context",
            {
                context_id: this.opts.contextId,
                access_token: this.opts.accessToken,
                sdp_offer: sdpOffer,
            },
            true,
            CONNECT_TIMEOUT_MS,
        )) as Record<string, any>;

        if (!result || !result.sdp_answer) {
            throw new Error("connect_to_realtime_context returned no sdp_answer");
        }

        await this.pc!.setRemoteDescription(
            new RTCSessionDescription({ type: "answer", sdp: result.sdp_answer })
        );

        return {
            success: !!result.success,
            model: result.model,
            voice: result.voice,
            agent: result.agent,
        };
    }

    /**
     * Open the `/ws-realtime` WebSocket and wire up the JSON-RPC layer + inbound
     * event handlers. Resolves once the socket is open.
     */
    private openWebSocket(): Promise<void> {
        return new Promise((resolve, reject) => {
            const realtimeUrl =
                process.env.EXPO_PUBLIC_REALTIME_WS_URL || 'ws://localhost:8000/ws-realtime';
            console.log(`[RealtimeConnection] Connecting to ${realtimeUrl}`);

            this.websocket = new WebSocket(realtimeUrl);

            const sender = (message: string) => {
                if (!this.websocket) {
                    throw new Error("WebSocket is not initialized");
                }
                this.websocket.send(message);
            };

            this.rpc = new JSONRPCPeer(sender);
            this.registerEventHandlers(this.rpc);

            this.websocket.onmessage = (event) => {
                this.rpc?.handleMessage(event.data);
            };

            this.websocket.onerror = (err) => {
                console.error("[RealtimeConnection] WebSocket error:", err);
                reject(err);
            };

            this.websocket.onclose = () => {
                console.log("[RealtimeConnection] WebSocket closed");
                // A close before/after connect signals a disconnected session.
                if (!this.closed) {
                    this.opts.onConnectionStateChanged?.(false);
                }
            };

            this.websocket.onopen = () => {
                console.log("[RealtimeConnection] WebSocket connected");
                resolve();
            };
        });
    }

    /**
     * Register the realtime server -> client notification handlers. These are
     * fire-and-forget (no `id`); we never reply to them.
     */
    private registerEventHandlers(rpc: JSONRPCPeer) {
        rpc.on("on_tool_call", (params) => {
            this.opts.onToolCall?.(params as unknown as ToolCallParams);
        });
        rpc.on("on_tool_response", (params) => {
            this.opts.onToolResponse?.(params as unknown as ToolResponseParams);
        });
        rpc.on("on_user_transcript", (params) => {
            this.opts.onUserTranscript?.(params as unknown as TranscriptParams);
        });
        rpc.on("on_agent_transcript", (params) => {
            this.opts.onAgentTranscript?.(params as unknown as TranscriptParams);
        });
        rpc.on("on_client_side_tool_calls", (params) => {
            // Pod tools are all server-side, so this should not fire in practice.
            console.log("[RealtimeConnection] on_client_side_tool_calls", params);
            this.opts.onClientSideToolCalls?.(params as unknown as ClientSideToolCallsParams);
        });
    }

    /**
     * Build the RTCPeerConnection: STUN-only ICE, mic track out, remote audio in,
     * and connection-state reporting.
     */
    private buildPeerConnection() {
        this.pc = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        });

        (this.pc as any).ontrack = (event: any) => {
            const [newStream] = event.streams;
            this._inboundMediaStream = newStream;
            console.log("[RealtimeConnection] Inbound media stream received");
            if (newStream) {
                this.opts.onInboundStreamReceived?.(newStream);
            }
        };

        (this.pc as any).onconnectionstatechange = () => {
            const state = (this.pc as any)?.connectionState;
            console.log("[RealtimeConnection] Connection state:", state);
            this.opts.onConnectionStateChanged?.(state === "connected");
            // Once the media path is actually up, tell the server we're ready.
            // For agent-speaks-first agents this is when the server fires the
            // greeting, so deferring it to here avoids clipping the first words.
            if (state === "connected") {
                this.signalClientReady();
            }
        };

        // Add local mic track(s).
        this.opts.mediaStream.getTracks().forEach((track) => {
            this.pc?.addTrack(track, this.opts.mediaStream);
        });
    }

    /**
     * Resolve once ICE gathering is complete (candidates are folded into the
     * offer SDP), or after a short timeout. Returns the gathered local SDP.
     */
    private waitForIceGatheringComplete(): Promise<string> {
        return new Promise((resolve) => {
            const pc = this.pc!;

            const finish = () => {
                clearTimeout(timer);
                (pc as any).onicecandidate = null;
                resolve(pc.localDescription?.sdp || "");
            };

            if ((pc as any).iceGatheringState === "complete") {
                resolve(pc.localDescription?.sdp || "");
                return;
            }

            const timer = setTimeout(finish, ICE_GATHERING_TIMEOUT_MS);

            (pc as any).onicecandidate = (event: any) => {
                // A null candidate signals the end of gathering.
                if (!event.candidate) {
                    finish();
                }
            };
        });
    }

    /**
     * Notify the server (once) that our WebRTC peer connection is established
     * and ready to receive audio. This is what triggers the agent-speaks-first
     * greeting server-side, so it must only fire after the media path is up.
     */
    private signalClientReady() {
        if (this.clientReadySent || this.closed || !this.rpc) return;
        this.clientReadySent = true;
        this.rpc
            .call("realtime_client_ready", {}, false)
            .catch((err) =>
                console.warn("[RealtimeConnection] realtime_client_ready failed:", err)
            );
    }

    /**
     * Send client-side tool results back to the server. Not used by pod tools
     * (all server-side) but provided for completeness.
     */
    async sendClientSideToolResponses(
        toolResponses: { tool_call_id: string; response: string }[]
    ): Promise<void> {
        if (!this.rpc) return;
        await this.rpc.call(
            "client_side_tool_responses",
            { tool_responses: toolResponses },
            false,
        );
    }

    /**
     * Tear down the peer connection, stop outbound tracks, and close the socket.
     */
    close() {
        console.log("[RealtimeConnection] Closing");
        this.closed = true;

        if (this.pc) {
            try {
                this.pc.close();
            } catch (error) {
                console.warn("[RealtimeConnection] Error closing peer connection:", error);
            }
            this.pc = undefined;
        }

        this.opts.mediaStream?.getTracks().forEach((track) => {
            try {
                track.stop();
            } catch {}
        });

        if (this.websocket) {
            try {
                this.websocket.close();
            } catch {}
            this.websocket = null;
        }

        this._inboundMediaStream = undefined;
        this.rpc = null;
    }
}
