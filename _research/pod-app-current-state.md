# ReBin `pod-app` — Current State Research (WebRTC / Agent Integration)

> **Purpose:** This document is the source-of-truth snapshot of how the ReBin `pod-app`
> (React Native / Expo) *currently* connects to the legacy "agent server" over WebRTC to
> have a voice conversation with an AI agent. It is intended to be handed to a planning
> agent that will refactor the app to instead connect to the Ajentify **TokenStreamingServer**
> `/ws-realtime` WebRTC endpoint (NOT using the Ajentify voice SDK).
>
> Everything below is **descriptive of the existing code** — nothing here is a proposal.
> All citations use `path:line` style, relative to `/Users/keanuinterone/Projects/ReBinProject/pod-app`
> unless otherwise noted.

---

## 0. Top Summary

- **WebRTC library:** [`react-native-webrtc@^124.0.7`](../package.json) (`package.json:56`). Standard `RTCPeerConnection`, `MediaStream`, `RTCView`, `mediaDevices`, `RTCIceCandidate`, `RTCSessionDescription`.
- **State management:** **MobX** (`mobx@^6.13.7`, `mobx-react-lite@^4.1.0`) — all stores use `makeAutoObservable`; UI components are wrapped in `observer(...)`.
- **Architecture:** The app does **not** talk directly to the agent server for signaling. It joins a **"room"** on a **signaling WebSocket server** (`room-signaling-server`), and the agent is a *peer* in that room. WebRTC peer connections are negotiated peer-to-peer through the signaling server via a **JSON-RPC-over-WebSocket** protocol. Once the mic-audio peer connection to the "Agent" peer is up, a **WebRTC data channel** carries a second layer of **JSON-RPC** messages that are the actual agent events (transcription, AI sentences, tool calls, calibration, etc.).
- **Two JSON-RPC layers, same class** (`src/services/webrtc/JSONRPCPeer.ts`):
  1. **Signaling RPC** over the WebSocket (join room, relay ICE, request connection).
  2. **Agent RPC** over the WebRTC data channel (all conversation/agent events).
- **Audio:** Mic captured via `mediaDevices.getUserMedia({audio,video:false})`; agent audio played through a hidden `RTCView` (`AudioPlayer.tsx`); speaker routing forced via `react-native-incall-manager`. Audio levels for the orb animation are polled from `RTCPeerConnection.getStats()`.
- **The "show bin classification" flow (MUST PRESERVE):** Driven entirely by an inbound **`tool_call`** event with `tool_name === "show_bin"`. The pod-app does **NOT** use client-side tools; the backend tools are all `is_client_side_tool: false` (server-side). The pod-app simply *listens* for the `tool_call` event that fires when the agent invokes a server-side tool, and drives UI off the `tool_name` + `tool_input`.
- **Session start entry point:** `app/(app)/index.tsx` → `createAgentContext()` → `agentRoomStore.initialize(contextId, clientApiKey)`.

---

## 1. Architecture Overview of the Current WebRTC Integration

### 1.1 Components involved

| Layer | File | Role |
|---|---|---|
| Signaling transport | `src/services/webrtc/RoomConnection.ts` | Opens WebSocket to signaling server, joins a "room", negotiates peer connections, relays ICE. |
| Peer / media / data channel | `src/services/webrtc/PeerConnection.ts` | Wraps a single `RTCPeerConnection`; STUN/TURN config; mic tracks out; agent audio track in; data channel create/receive. |
| JSON-RPC framing | `src/services/webrtc/JSONRPCPeer.ts` | Request/response + notification framing. Reused for BOTH the signaling WS and the agent data channel. |
| Orchestration / state | `src/stores/agentroom.store.ts` | The heart: creates room, invites agent, wires data-channel RPC handlers, holds all UI-driving observable state. |
| Media devices | `src/stores/mediadevice.store.ts` | Mic permission + `getUserMedia` + device enumeration. |
| Audio levels | `src/services/audio/AudioLevelMonitor.ts` | Polls `getStats()` for `audioLevel` (orb animation). |
| Auth / API | `src/services/api/**` | REST calls to the **pod-backend** (context creation, user, auth). |
| Screen | `app/(app)/index.tsx` | Mounts the whole agent room UI, start/stop session. |

### 1.2 Three distinct network endpoints

1. **`EXPO_PUBLIC_API`** (pod-backend REST, via axios) — auth + `POST /create-agent-context` returns `{ context_id, client_api_key }`. Value in `.env:1`: `https://t12ms9b4j8.execute-api.ap-southeast-2.amazonaws.com/prod`.
2. **`EXPO_PUBLIC_SIGNALING_SERVER_URL`** (WebSocket signaling / rooms) — the app connects to `${signalingUrl}/ws`. Value in `.env:3`: `wss://room-signaling-server.prod.rooms.ajentify.com`. Default fallback `ws://localhost:8080` (`RoomConnection.ts:58`).
3. **`EXPO_PUBLIC_AGENT_SERVER_URL`** (agent server, REST) — `POST /invite-agent` to get the agent to join the room. Value in `.env:4`: `https://agent.ajentify.com`. Default fallback `http://localhost:8000` (`agentroom.store.ts:288`).

Other env (`.env`):
- `EXPO_PUBLIC_AJENTIFY_API=https://api.ajentify.com` (`.env:2`) — present but not referenced in code searched.
- `EXPO_PUBLIC_AGENT_ID=b87d41c6-38a0-49e3-a9a8-c94349c17a4c` (`.env:5`) — present but not referenced in the WebRTC/store code (agent identity is decided server-side by the invite).
- `EXPO_PUBLIC_TURN_USERNAME` / `EXPO_PUBLIC_TURN_CREDENTIAL` — TURN creds, with hard-coded fallbacks in `PeerConnection.ts:57-73`.

> **Note for refactor:** the constants file `src/services/api/_config/constants.ts` only defines `const BASE_URL = process.env.EXPO_PUBLIC_API` (`constants.ts:1`) and it is not exported/used; env vars are read inline via `process.env.EXPO_PUBLIC_*` throughout.

### 1.3 Key insight: the "agent" is a WebRTC peer, not a direct server

The current design assumes a **multi-peer room model**:
- The pod-app joins a room named by `context_id`.
- If no peer describing itself as `"Agent"` is already in the room, the app calls the agent server's `/invite-agent` REST endpoint to make the agent join.
- The agent then appears as a peer; the app opens a peer connection to it, streams mic audio up, receives agent audio down, and opens a **data channel** for the JSON-RPC event stream.

This is the piece most likely to change for the `/ws-realtime` refactor (which is presumably a direct client↔server WebRTC connection, no room/peer-discovery/invite indirection).

---

## 2. End-to-End Sequence: How a Voice Session Currently Starts

Numbered, with citations. Entry point is the "Start Conversation" button in `app/(app)/index.tsx`.

1. **User taps "Start Conversation"** → `handleStartConversation()` (`app/(app)/index.tsx:62`).
2. **Create context (REST, authenticated):** `createAgentContext()` (`index.tsx:69`) → `POST /create-agent-context` via axios `apiClient` (`src/services/api/context/createcontext.ts:15`). The axios request interceptor attaches `Authorization: Bearer <access_token>` from the auth store (`src/services/api/_config/apiclient.ts:14-26`). Response type: `{ context_id: string; client_api_key: string }` (`createcontext.ts:3-6`).
3. **Store context id** (`index.tsx:72`) and call `agentRoomStore.initialize(context.context_id, context.client_api_key)` (`index.tsx:75`).
4. **Initialize media devices** (`agentroom.store.ts:216`): `mediaDeviceStore.initializeMediaDevices()` requests mic permission (Android `PermissionsAndroid`, iOS via Info.plist) and enumerates audio input devices (`mediadevice.store.ts:65-108`).
5. **Get mic MediaStream** (`agentroom.store.ts:226`) via `mediaDeviceStore.getMediaStream(deviceId)` → `getUserMedia({audio, video:false})` (`mediadevice.store.ts:113-133`).
6. **Force speakerphone on** via `InCallManager.start(...)` + `setForceSpeakerphoneOn(true)` (`agentroom.store.ts:233-235`).
7. **Create `RoomConnection`** (`agentroom.store.ts:242-254`) with `id = contextId`, `selfDescription = "User"`, and callbacks `onPeerAdded`, `onConnectionRequest`, `onPeerConnectionStateChanged`.
8. **Join room (WebSocket signaling):** `roomConnection.joinRoom()` (`agentroom.store.ts:258`):
   - Opens `new WebSocket(`${signalingUrl}/ws`)` (`RoomConnection.ts:62`).
   - Wraps it in a `JSONRPCPeer` as the **signaling RPC** layer (`RoomConnection.ts:73`), registering signaling handlers: `peer_added`, `connection_request`, `add_ice_candidate` (`RoomConnection.ts:74-76`).
   - On WS open, calls RPC `join` with `{ room_id, self_description }` and awaits the list of existing peers (`RoomConnection.ts:108-113`).
9. **Detect agent presence** (`agentroom.store.ts:262-264`): checks `existing_peers[].self_description === "Agent"`.
10. **Invite agent if absent** (`agentroom.store.ts:266-271`): `inviteAgent(contextId, clientApiKey)` → `POST ${AGENT_SERVER_URL}/invite-agent` with header `Authorization: <clientApiKey>` (NB: raw key, not `Bearer`) and body `{ context_id }` (`agentroom.store.ts:285-312`).
11. **Signaling: agent joins → `peer_added` notification** arrives on the WS (`RoomConnection.ts:192`). This triggers the **initiator** flow:
    - `onPeerAdded(peer_id, self_description)` domain callback → in the store, since `self_description === "Agent"`, it creates the peer **with a data channel** (`agentroom.store.ts:317-325`).
    - `configurePeer()` wires ICE relay + connection-state handlers (`RoomConnection.ts:131-189`).
    - Creates SDP **offer**, `setLocalDescription(offer)` (`RoomConnection.ts:211-212`).
    - Sends RPC `request_connection` `{ peer_id, self_description, offer }` and awaits an `answer` (`RoomConnection.ts:219-223`).
    - `setRemoteDescription(answer)` (`RoomConnection.ts:232`).
    *(The reverse path — `connection_request` from another peer — is handled at `RoomConnection.ts:240-271`, creating an answer. In practice the app is the initiator toward the Agent.)*
12. **ICE exchange:** local candidates relayed via RPC `relay_ice_candidate` `{ peer_id, candidate }` (`RoomConnection.ts:150-153`); remote candidates arrive via `add_ice_candidate` notification and are added with `addIceCandidate` (`RoomConnection.ts:274-294`).
13. **Peer connection state → connected:** `onconnectionstatechange` fires `onPeerConnectionStateChanged(peerId, connected)` (`RoomConnection.ts:163-175`), which sets `isConnected/isConnecting` in the store (`agentroom.store.ts:247-253`).
14. **Media tracks:**
    - Outbound mic tracks added to the PC in `PeerConnection.initialize()` (`PeerConnection.ts:122-125`).
    - Inbound agent audio arrives via `ontrack` → stored as `inboundMediaStream` + `onInboundStreamReceived` callback (`PeerConnection.ts:108-119`). The store uses that callback to start the **agent audio level monitor** (`agentroom.store.ts:359-373`).
15. **Data channel opens (agent RPC layer):** In `onPeerAddedOrConnectionRequest` the store creates `agentRPCLayer = new JSONRPCPeer(peer.sendMessage)` (`agentroom.store.ts:376`), registers all agent event handlers via `setupAgentCallbacks(peerId)` (`agentroom.store.ts:377`, `406-517`), and sets `peer.setOnDataChannelMessage(agentRPCLayer.handleMessage)` (`agentroom.store.ts:380`). The data channel itself (named `"chat"`) is created because this peer is the initiator (`PeerConnection.ts:79-90`); incoming data-channel messages are routed to the RPC handler (`PeerConnection.ts:86-104`).
16. **Agent event stream begins:** the agent sends JSON-RPC **notifications** over the data channel (`agent_status`, `calibration_status`, `speech_detected`, `ai_sentence`, `tool_call`, etc.) which drive all UI state (see §3). The user audio-level monitor is also started ~100ms after peer setup (`agentroom.store.ts:384-397`).
17. **Screen gating:** `index.tsx` shows a status button until `agentRoomStore.isReady` is true, transitioning through labels "Waking pod up..." → "Calibrating..." → "Getting ready..." based on `isTranscriptionReady` / `hasCalibrated` / `isReady` (`index.tsx:160-192`).

### 2.1 Session stop

- "End Conversation" → `handleEndConversation()` (`index.tsx:95`) → `agentRoomStore.leaveRoom()` (`agentroom.store.ts:735`): stops audio monitors, stops mic tracks, `InCallManager.stop()`, `mediaDeviceStore.cleanup()`, then `reset()`.
- `reset()` (`agentroom.store.ts:124`) calls `roomConnection.leaveRoom()` (`RoomConnection.ts:297`) which closes all peer connections + the WS, and clears all observable state back to initial.
- Also cleaned up on component unmount (`index.tsx:49-56`).

---

## 3. Complete Reference Table of Inbound Agent Events

All inbound agent events are **JSON-RPC notifications** received on the **WebRTC data channel** and dispatched by `JSONRPCPeer.handleMessage` (`JSONRPCPeer.ts:89`) to handlers registered in `AgentRoomStore.setupAgentCallbacks` (`agentroom.store.ts:406-517`). Each handler name is the RPC `method`. The `tool_call` handler further routes by `tool_name` (`agentroom.store.ts:523-577`).

> **Legend:** **core (preserve)** = required for the essential bin-classification/reward experience the refactor must keep working. **UI-driving (reworkable)** = drives conversational/status UI that may be redesigned for the new server.

| # | Method (`method`) | Params | What it does | Store state written | UI component | Classification |
|---|---|---|---|---|---|---|
| 1 | `data_channel_connection_status` | `{ status }` | Marks connection status. | `isConnected = status === "connected"` (`agentroom.store.ts:409-414`) | (gates conversation UI) | UI-driving (reworkable) |
| 2 | `calibration_status` | `{ status }` | Tracks mic calibration. `"started"` → calibrating; `"complete"` → calibrated. | `isCalibrating`, `hasCalibrated` (`agentroom.store.ts:416-422`) | Start-screen status label (`index.tsx:164`) | UI-driving (reworkable) |
| 3 | `agent_status` | `{ status }` | Lifecycle: `"waking_up"`→ transcription not ready; `"calibrating"`→ transcription ready; `"ready"`→ session ready. | `isTranscriptionReady`, `isReady` (`agentroom.store.ts:424-435`) | Start/status gating (`index.tsx:163-170`) | UI-driving (reworkable) |
| 4 | `is_speaking_status` | `{ is_speaking }` | User VAD. On start, ensures a current user-message entry exists; on stop, finalizes it. | `isUserSpeaking`, `userMessages[]`, `currentUserMessageId`, `currentDetectedSpeech`, `userMessageCounter` (`agentroom.store.ts:437-458`) | `TranscriptionDisplay` | UI-driving (reworkable) |
| 5 | `speech_detected` | `{ text }` | Live/partial user transcription; creates or updates the current user message text. | `currentDetectedSpeech`, `userMessages[].text`, `currentUserMessageId` (`agentroom.store.ts:460-482`) | `TranscriptionDisplay` | UI-driving (reworkable) |
| 6 | `ai_sentence` | `{ sentence, sentence_id }` | Appends an AI sentence to the transcript. | `aiMessages[]`, `showAIMessages = true` (`agentroom.store.ts:484-490`) | `AIMessageDisplay` | UI-driving (reworkable) |
| 7 | `is_speaking_sentence` | `{ sentence_id }` | Marks which AI sentence is currently being spoken (bold + autoscroll). | `currentlySpeakingSentenceId` (`agentroom.store.ts:492-497`) | `AIMessageDisplay` | UI-driving (reworkable) |
| 8 | `stoped_speaking` *(sic)* | *(none)* | AI finished speaking; clears the active-sentence highlight (keeps messages). | `currentlySpeakingSentenceId = undefined` (`agentroom.store.ts:499-506`) | `AIMessageDisplay` | UI-driving (reworkable) |
| 9 | `tool_call` | `{ tool_name, tool_input }` | **The UI trigger for server-side tool invocations.** Routes by `tool_name` (see §4 / §6). | Varies (bin queue, slide-up) | `BinClassificationView`, `RewardPanel`, `SlideUpView`/`ARLAndRICView` | **`show_bin` = core (preserve)**; `show_arl_and_ric` = UI-driving |
| 10 | `tool_response` | `{ tool_name, tool_output }` | For `show_bin` only: syncs authoritative points total. | `authStore.user.points = new_total` (`agentroom.store.ts:513-516`, `584-596`) | Points display (via user) | **core (preserve)** |

> **Important:** `JSONRPCPeer.handleMessage` silently ignores any `method` with no registered handler (`JSONRPCPeer.ts:104-106`), so the agent may emit other methods that the pod-app currently drops.

### 3.1 Detail: user-transcription state machine (events 4 & 5)

`is_speaking_status` and `speech_detected` cooperate to build `userMessages` (a persistent history array of `{ text, message_id }`). Either event can create the "current" message first (handled defensively in both), and `is_speaking_status:false` finalizes it by clearing `currentUserMessageId`/`currentDetectedSpeech` (`agentroom.store.ts:437-482`). IDs are locally generated (`user-msg-<counter>`), not server-provided.

---

## 4. Tool-Call Handling (server-side tools, UI triggered off events)

The pod-app does **not** register or execute client-side tools. Confirmed on the backend: every tool in `ajentify.json` has `is_client_side_tool: false` (e.g. `show_bin` at `pod-backend/ajentify/ajentify.json:131`). Instead, the agent server emits a `tool_call` notification over the data channel whenever the agent invokes a (server-side) tool, and the pod-app switches UI on `tool_name`.

`agentToolCallHandler(tool_name, tool_input)` (`agentroom.store.ts:523-577`):

- **`show_arl_and_ric`** → opens the slide-up view: `slideUpViewContentType = "arl_and_ric"`, `slideUpViewShouldShow = true` (`agentroom.store.ts:527-533`). Rendered by `SlideUpView` → `ARLAndRICView` (`index.tsx:127-134`, `289-295`). **UI-driving (reworkable).**
- **`show_bin`** → the **core bin-classification flow** (see §6). Builds a queue of bins and animates them, then optionally shows a reward panel (`agentroom.store.ts:535-571`). **core (preserve).**
- **default** → logs "Unknown tool name" and does nothing (`agentroom.store.ts:574-576`).

`agentToolResponseHandler(tool_name, tool_output)` (`agentroom.store.ts:584-596`): only acts on `show_bin`; parses `tool_output` and, if it contains a numeric `new_total`, writes it to `authStore.user.points`.

> **`parseToolOutput` quirk (`agentroom.store.ts:22-41`):** the agent server delivers `tool_output` as a *string* built from Python's `str(dict)` (single-quoted, `True/False/None`), so the store accepts a real object, a JSON string, or a Python-repr string and coerces it to an object.

---

## 5. Outbound Calls the pod-app Makes

### 5.1 REST (axios / fetch)

| Call | Method/URL | Auth | Where |
|---|---|---|---|
| Create agent context | `POST {EXPO_PUBLIC_API}/create-agent-context` | `Bearer <access_token>` (interceptor) | `createcontext.ts:15`, interceptor `apiclient.ts:14-26` |
| Invite agent | `POST {EXPO_PUBLIC_AGENT_SERVER_URL}/invite-agent` body `{ context_id }` | Header `Authorization: <client_api_key>` (raw, no Bearer) | `agentroom.store.ts:289-301` |
| (Other REST: auth, user, councils, bin systems) | see `src/services/api/**` | Bearer or public | §7.3 |

### 5.2 Signaling RPC (over WebSocket, `JSONRPCPeer`)

| RPC method | Params | Await? | Where |
|---|---|---|---|
| `join` | `{ room_id, self_description }` | yes | `RoomConnection.ts:108-111` |
| `request_connection` | `{ peer_id, self_description, offer }` | yes (10s) | `RoomConnection.ts:219-223` |
| `relay_ice_candidate` | `{ peer_id, candidate }` | no | `RoomConnection.ts:150-153` |

### 5.3 Agent RPC (over WebRTC data channel)

- The pod-app **registers handlers** (§3) but makes **no outbound agent RPC `call`s** on the data channel in the current code. Communication *to* the agent is purely via the **audio track (mic)**. (`agentRPCLayer.on(...)` only; no `agentRPCLayer.call(...)` anywhere in `agentroom.store.ts`.)

---

## 6. The `show_bin` (Bin-Classification) Flow — Detailed (MUST PRESERVE)

This is the key functionality the refactor must keep working.

### 6.1 Trigger & payload shape

Trigger: inbound `tool_call` notification with `tool_name === "show_bin"` (`agentroom.store.ts:508-511` → `535`).

**`tool_input` shape** (confirmed against the backend tool schema `pod-backend/ajentify/ajentify.json:89-127`):

```jsonc
{
  "bins": [
    { "type": "kerbside" | "pod", "color": "Red" | "Yellow" | "Lime Green" | ... }
    // ordered; at least one entry; one entry per UNIQUE destination bin
  ],
  "show_reward": true | false,
  "points": 0            // integer; when show_reward=true, 5 × (# correctly-classified components); else 0
}
```

**`tool_output` shape** (from `pod-backend/ajentify/tools/show_bin.py:1-45`), delivered to `tool_response` as a Python-repr string:

```jsonc
{
  "shown": ["kerbside bin: Yellow", ...],
  "points_awarded": 0,           // 0 or `points`
  "new_total": 20                // authoritative user point total (or null when no reward)
}
```

Only `new_total` (numeric) is consumed by the app (`agentroom.store.ts:587-595`).

### 6.2 What the store does on `show_bin` (`agentroom.store.ts:535-571`)

1. Normalizes `tool_input.bins` into `BinSpec[]` = `{ type: "kerbside"|"pod"; color: string(lowercased) }` (`agentroom.store.ts:536-540`). `type` defaults to `"kerbside"` unless exactly `"pod"`; `color` is lowercased (matters for the image map, §6.3).
2. Reads `show_reward` (bool) and `points` (number) (`agentroom.store.ts:542-543`).
3. Hides the slide-up view, clears bin/reward timers, resets reward panel (`agentroom.store.ts:546-549`).
4. Stashes `pendingShowReward` / `pendingRewardPoints` (`agentroom.store.ts:551-552`).
5. If `bins` empty: clears the queue; if a reward is somehow pending with points > 0, shows the reward panel directly (`agentroom.store.ts:554-563`).
6. Otherwise: sets `binClassificationQueue = queue`, `binClassificationIndex = 0`, `binClassificationShouldShow = true`, and starts the advance timer (`agentroom.store.ts:565-568`).

### 6.3 Bin queue animation + reward hand-off

- **Per-bin timing:** `PER_BIN_MS = 6000` (`agentroom.store.ts:13`). `scheduleNextBinAdvance()` advances `binClassificationIndex` every 6s (`agentroom.store.ts:602-618`).
- **End of queue:** `finishBinSequence()` hides the bin view; if `pendingShowReward && pendingRewardPoints > 0`, calls `showRewardPanel()` (`agentroom.store.ts:624-632`).
- **Reward panel:** `showRewardPanel()` sets `rewardPanelPoints` + `rewardPanelShouldShow`, auto-hides after `REWARD_PANEL_MS = 3000` (`agentroom.store.ts:14`, `634-650`).
- **Computed getters** feed the current bin to the view: `currentBinColor`, `currentBinType` (`agentroom.store.ts:113-119`).
- **Manual dismiss:** tapping the conversation area while a bin/reward overlay is showing calls `dismissActiveOverlay()` (`index.tsx:217-221`, store `agentroom.store.ts:667-679`).

### 6.4 Rendering (`BinClassificationView.tsx` + `index.tsx`)

- In `index.tsx:233-244`, the central orb slot renders `BinClassificationView` when `binClassificationShouldShow && (currentBinColor || currentBinType === "pod")`, else `RewardPanel` when `rewardPanelShouldShow`, else the `Orb`.
- Props passed: `color = currentBinColor`, `binType = currentBinType`, `podConfiguration = authStore.user?.pod_configuration`, `visible = binClassificationShouldShow` (`index.tsx:234-238`).
- `BinClassificationView` (`BinClassificationView.tsx:86-180`):
  - **Kerbside bins** → maps lowercased color → image via `KERBSIDE_BIN_IMAGE_MAP` (keys: `yellow, red, blue, green, lime green, purple, maroon`) (`BinClassificationView.tsx:12-20`), falling back to `no-bins-ic.png`.
  - **Pod bins** → resolves a `PodBinKey` from `podConfiguration` (`in_drawer`/`under_sink`/`freestanding`) + color via `getPodBinKey` (`BinClassificationView.tsx:55-73`), then `POD_BIN_CONFIG` gives image + arrow position (`BinClassificationView.tsx:40-53`). Pod colors supported: red/yellow/green/white (freestanding splits top/bottom by color).
  - Animated entrance (opacity/scale) + bouncing arrow (`BinClassificationView.tsx:91-117`).
- `pod_configuration` comes from the authenticated user (`UserResolved.pod_configuration`, `types/user.ts:20`).

> **Refactor-critical dependencies for `show_bin`:** (a) an inbound event carrying `{bins:[{type,color}], show_reward, points}`; (b) a follow-up carrying `new_total` for the points sync; (c) access to `authStore.user.pod_configuration` for pod-bin rendering. The exact transport (data channel vs `/ws-realtime` messages) can change, but these data shapes and the UI it drives should be preserved.

---

## 7. Context / Auth / API Layer

### 7.1 Auth model (`src/stores/auth.store.ts`, `src/services/api/_config/tokens.ts`)

- **Token storage:** access + refresh JWTs in `expo-secure-store` (`tokens.ts:1-33`); mirrored in module-level vars for sync access.
- **Expiry:** `jwt-decode` checks `exp` (`tokens.ts:38-48`).
- **Bootstrap** (`auth.store.ts:36-86`): loads tokens; if access valid → logged in + `fetchUser()`; if access expired but refresh valid → `refreshAccessToken()`; else logged out.
- **Email OTP login:** `sendEmailVerification` → `verifyCode` (`auth.store.ts:88-130`) returns either logged-in (tokens) or `needs_account` (`create_account_token`).
- **Access-token accessor** `getAccessToken()` (`auth.store.ts:159-196`) auto-refreshes and de-dupes concurrent refreshes.
- **Axios interceptor** injects `Bearer` token for non-public requests (`apiclient.ts:14-27`); `apiClient` baseURL = `EXPO_PUBLIC_API` (`apiclient.ts:11`).

### 7.2 Context creation & the "client API key" (the WebRTC credential)

- `createAgentContext()` (`createcontext.ts:13-26`) → `POST /create-agent-context` (authenticated). Returns `{ context_id, client_api_key }`.
- `context_id` is used as the **room id** (`agentroom.store.ts:244`).
- `client_api_key` is a **short-lived client key** used only as the `Authorization` header when calling the agent server's `/invite-agent` (`agentroom.store.ts:296`). The pod-backend creates the Ajentify context server-side (with the real server API key) and returns this short-lived key for the frontend (see docstring `createcontext.ts:8-12`).
- The signaling WebSocket connection itself is currently **unauthenticated** (no token on `${signalingUrl}/ws`) — room membership is gated only by knowing the `context_id`.

### 7.3 API modules (`src/services/api/`)

| File | Purpose |
|---|---|
| `context/createcontext.ts` | `POST /create-agent-context` → `{context_id, client_api_key}` |
| `auth/sendemailverification.ts` | Start email OTP challenge |
| `auth/verifyemail.ts` | Verify OTP → tokens or create-account token |
| `auth/createaccount.ts` | Create account |
| `auth/refreshtoken.ts` | `refresh_token` → new tokens |
| `user/getuser.ts` | `getCurrentUser()` → `UserResolved` |
| `user/updateuser.ts` | Update user |
| `councils/councilsforpostcode.ts` | Council lookup by postcode |
| `binsystems/binsystemforcouncil.ts` | Bin system for a council |
| `_config/apiclient.ts` | axios instance + Bearer interceptor |
| `_config/tokens.ts` | secure-store token mgmt + JWT expiry |
| `_config/constants.ts` | `BASE_URL` (unused-ish) |

### 7.4 Data types (`src/services/api/types/`)

- **`context.ts`** — `Context { context_id, agent_id, created_at, updated_at }` (note: the *response* type used at runtime is `CreateAgentContextResponse` in `createcontext.ts`, which only has `context_id` + `client_api_key`).
- **`user.ts`** — `PodConfiguration = 'freestanding' | 'in_drawer' | 'under_sink' | 'none'`; `User` (raw, has `council_id`/`bin_system_id`/`points`); `UserResolved` (has nested `council`, `bin_system`, `pod_configuration`, `points`). The store mutates `authStore.user.points` on reward (`user.ts:17-26`).
- **`binsystem.ts`** — `Bin { id, acceptsCardboard, acceptsContainers, acceptsFood, acceptsGarbage, acceptsGarden, acceptsGlass, acceptsSoftPlastics, appearance, extras[], type }`; `BinSystem { id, bins[] }`. *(Used for council/user bin data; note this is distinct from the `show_bin` `tool_input.bins` shape, which is just `{type,color}`.)*
- **`council.ts`** — council type (referenced by `UserResolved`).

---

## 8. Component-by-Component UI Map

Screen root: `app/(app)/index.tsx` (`observer(Home)`). Layout: `app/(app)/_layout.tsx` is an `expo-router` `Stack` (headerless) registering `index`, `landing`, `profile`, `bin-config-preview`, `levels`, `community` (`_layout.tsx:8-21`).

| Component | File | Renders | Driven by (store state / event) | Classification |
|---|---|---|---|---|
| **Home screen** | `app/(app)/index.tsx` | Whole agent-room UI; start/stop; layout regions (AI 50% / center 30% / transcription 20%) | Almost all `agentRoomStore` state | mixed |
| **Orb** | `src/components/Orb.tsx` | Animated Skia sphere reacting to agent voice | `aiAudioLevel` (from `agentAudioLevel` state, fed by `onAgentAudioLevel` → `AudioLevelMonitor`); `userAudioLevel` accepted but **ignored** (`Orb.tsx:29-36`, `154-158`) | UI-driving (reworkable) |
| **BinClassificationView** | `src/components/agentroom/BinClassificationView.tsx` | Kerbside/pod bin image + bouncing arrow | `binClassificationShouldShow`, `currentBinColor`, `currentBinType`, `authStore.user.pod_configuration` ← `tool_call` `show_bin` | **core (preserve)** |
| **RewardPanel** | `src/components/agentroom/RewardPanel.tsx` | "+N points" card | `rewardPanelShouldShow`, `rewardPanelPoints` ← end of `show_bin` queue when `show_reward` | **core (preserve)** |
| **AIMessageDisplay** | `src/components/agentroom/AIMessageDisplay.tsx` | Scrolling AI sentence list, bold = speaking | `aiMessages`, `currentlySpeakingSentenceId`, `showAIMessages` ← `ai_sentence` / `is_speaking_sentence` / `stoped_speaking` | UI-driving (reworkable) |
| **TranscriptionDisplay** | `src/components/agentroom/TranscriptionDisplay.tsx` | Scrolling user speech history, bold = active | `userMessages`, `currentUserMessageId` ← `speech_detected` / `is_speaking_status` | UI-driving (reworkable) |
| **AudioPlayer** | `src/components/agentroom/AudioPlayer.tsx` | Hidden `RTCView` (0×0) playing agent audio | `inboundAudioStream` = first peer's `inboundMediaStream` (`index.tsx:137-139`) | **core (preserve)** (needed to hear the agent) |
| **SlideUpView** | `src/components/agentroom/SlideUpView.tsx` | Bottom sheet modal (drag/tap dismiss) | `slideUpViewShouldShow`; content chosen by `slideUpViewContentType` | UI-driving (reworkable) |
| **ARLAndRICView** | `src/components/agentroom/ARLAndRICView.tsx` | Static ARL + RIC info images inside SlideUpView | `tool_call` `show_arl_and_ric` → `slideUpViewContentType="arl_and_ric"` | UI-driving (reworkable) |
| **bin-config-preview screen** | `app/(app)/bin-config-preview.tsx` | Dev/preview screen cycling all `POD_BIN_CONFIG` keys through `BinClassificationView` | Local state only (not agent-driven) | dev tool (not part of live flow) |
| **landing screen** | `app/(app)/landing.tsx` | Splash logo, auto-navigates to `/(app)` after 3s | timer only | UI-driving (reworkable) |
| **MenuDrawer** | `src/components/MenuDrawer.tsx` (referenced `index.tsx:6`) | Nav drawer | local `isMenuOpen` | UI-driving |

### 8.1 Audio level flow (orb)

- `index.tsx:38-46` registers `setOnUserAudioLevel` / `setOnAgentAudioLevel` callbacks → local React state → `Orb` props.
- Store creates two `AudioLevelMonitor`s: agent (`inbound`) when the inbound stream arrives (`agentroom.store.ts:359-373`), user (`outbound`) ~100ms after peer setup (`agentroom.store.ts:384-397`).
- `AudioLevelMonitor` polls `pc.getStats()` every 100ms reading `audioLevel` from `media-source`/`inbound-rtp`/`track` reports (`AudioLevelMonitor.ts:66-101`).

---

## 9. Main Screen Wiring (`app/(app)/index.tsx`)

- **Store access:** `const { agentRoomStore, authStore } = useStores()` (`index.tsx:25`) — `useStores` from `src/providers/StoreProvider.tsx` (React context over the singleton `rootStore`).
- **Start:** `handleStartConversation` (`index.tsx:62-89`): create context → `initialize`. Guards with `isCreatingContext` + `hasInitialized` ref.
- **Gating:** while `!currentContextId || !agentRoomStore.isReady`, renders the start/status button screen (`index.tsx:170-192`); status label derived from `isTranscriptionReady`/`hasCalibrated`/`isReady` (`index.tsx:160-167`).
- **In-conversation layout** (`index.tsx:195-297`): top bar + hidden `AudioPlayer` + a `Pressable` conversation area (tap dismisses active overlay) with 3 regions (AI messages, center orb/bin/reward, transcription), + controls (End Conversation, mic mute), + `SlideUpView`, + `MenuDrawer`.
- **Stop:** `handleEndConversation` (`index.tsx:95-101`) + unmount cleanup (`index.tsx:49-56`).
- **Mic mute:** `agentRoomStore.toggleMicrophone()` toggles track `.enabled` on local + peer outbound streams (`agentroom.store.ts:696-730`).

---

## 10. Dependencies (installed, relevant to the refactor)

From `package.json` (`package.json:19-71`):

| Package | Version | Role |
|---|---|---|
| `react-native-webrtc` | `^124.0.7` | WebRTC (PC, MediaStream, RTCView, mediaDevices, ICE/SDP) |
| `react-native-incall-manager` | `^4.2.1` | Force speakerphone / audio routing during call |
| `mobx` | `^6.13.7` | Observable state |
| `mobx-react-lite` | `^4.1.0` | `observer()` bindings |
| `uuid` + `react-native-get-random-values` | `^13.0.0` / `~1.11.0` | JSON-RPC request ids (`JSONRPCPeer.ts:2-3`) |
| `axios` | `^1.11.0` | REST client (`apiClient`) |
| `jwt-decode` | `^4.0.0` | JWT expiry checks |
| `expo-secure-store` | `~15.0.8` | Token storage |
| `@shopify/react-native-skia` | `2.2.12` | Orb rendering |
| `react-native-reanimated` | `~4.1.1` | Animations (bins, panels, transcripts) + `react-native-worklets` `0.5.1` |
| `react-native-gesture-handler` | `~2.28.0` | SlideUpView drag |
| `expo` / `expo-router` | `^54.0.0` / `~6.0.23` | App framework + routing |
| `react-native` / `react` | `0.81.5` / `19.1.0` | RN core |
| `expo-haptics`, `expo-image`, `expo-blur`, `@expo/vector-icons`, `react-native-markdown-display` | various | UI misc |

> **No WebSocket library dependency** — signaling uses the RN-global `WebSocket` (`RoomConnection.ts:62`). **No Ajentify voice SDK is installed.** There is **no standalone `ws` / socket.io** dependency; everything rides on `WebSocket` + `react-native-webrtc` data channel.

---

## 11. Other Relevant Patterns & Notes

- **State management:** MobX singletons. `RootStore` (`src/stores/root-store.ts`) instantiates `AuthStore`, `AccountCreationStore`, `AgentRoomStore` (given `authStore`) and exports a singleton `rootStore` (`root-store.ts:32`). `StoreProvider` (`src/providers/StoreProvider.tsx`) provides it via context and calls `rootStore.bootstrap()` once on mount. `mediaDeviceStore` is its own module-level singleton (`mediadevice.store.ts:168`).
- **Reactivity:** UI components use `observer(...)`; store mutations wrapped in `runInAction` for async paths.
- **Theming:** `useTheme()` from `src/providers/ThemeProvider` supplies `colors`, `fonts`, `space` (used across components, e.g. `SlideUpView.tsx:31`, `RewardPanel.tsx:18`).
- **JSON-RPC framing** (`JSONRPCPeer.ts`): messages are `{ method, params, id }`. `id` present ⇒ request expecting response; absent ⇒ fire-and-forget notification. Responses are `{ id, result }`. Response waiting is a 100ms poll loop up to `timeout` (`JSONRPCPeer.ts:63-77`). Unhandled inbound methods are dropped (`JSONRPCPeer.ts:104-106`). Errors surface as `{ result: { error } }`.
- **Naming quirk to preserve/watch:** the AI-finished event method is misspelled **`stoped_speaking`** (single "p") (`agentroom.store.ts:499`) — must match whatever the new server emits.
- **TURN/STUN** are hardcoded to `metered.ca` relays with fallback creds in code (`PeerConnection.ts:50-75`) — the `/ws-realtime` server may require different ICE config.
- **Data channel name** is `"chat"` (`PeerConnection.ts:80`).
- **`self_description` strings** `"User"` / `"Agent"` are load-bearing for the room/peer model (`agentroom.store.ts:244`, `262-264`, `320`).
- **Legacy docs present** (may be stale): `SETUP_GUIDE.md`, `QUICKSTART.md`, `VOICE_CHAT_ENV.md`, `IMPLEMENTATION_SUMMARY.md` reference an older `EXPO_PUBLIC_API_BASE_URL` name (the live code uses `EXPO_PUBLIC_API`).

---

## 12. Refactor-Relevant Summary (what changes vs. what stays)

**Likely to change (transport/signaling):**
- Room/peer-discovery model (`RoomConnection.ts`), `/invite-agent` REST call, signaling RPC methods (`join`, `request_connection`, `relay_ice_candidate`), and the "Agent as peer" assumption — all likely replaced by a direct connection to TokenStreamingServer `/ws-realtime`.
- How SDP offer/answer + ICE are exchanged (currently via signaling-WS JSON-RPC).
- How the event channel is established (currently a WebRTC data channel named `"chat"`; the new server may deliver events over the `/ws-realtime` WebSocket itself and/or a data channel).

**Should be preserved (product behavior + data shapes):**
- Mic capture + agent audio playback (`react-native-webrtc`, `AudioPlayer`, `InCallManager`).
- The inbound event → UI mapping in §3, especially:
  - **`show_bin`** `{bins:[{type,color}], show_reward, points}` → bin queue animation + reward panel (§6). **Core.**
  - Points sync from `new_total` (§4/§6.1). **Core.**
- MobX store shape (`AgentRoomStore`) as the integration point for the UI.
- Auth/context creation via pod-backend (`createAgentContext`).

---

*End of research document.*
