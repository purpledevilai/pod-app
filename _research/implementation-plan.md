# Pod App Realtime Refactor — Implementation Plan

> **For the implementation agent.** This is an executable, step-by-step plan to
> migrate the ReBin `pod-app` off the legacy "agent server" room/WebRTC integration
> and onto the Ajentify **TokenStreamingServer** (TSS) `/ws-realtime` endpoint, plus
> the three server-side **enabling changes** that must land first/alongside.
>
> **Read these first** (same folder) for full context + citations:
> - [`00-overview.md`](./00-overview.md) — synthesis, decisions, enabling-change specs.
> - [`pod-app-current-state.md`](./pod-app-current-state.md) — current pod-app internals.
> - [`token-streaming-server-realtime.md`](./token-streaming-server-realtime.md) — target `/ws-realtime` wire contract.
>
> **Repos referenced (absolute paths):**
> - pod-app: `/Users/keanuinterone/Projects/ReBinProject/pod-app`
> - pod-backend: `/Users/keanuinterone/Projects/ReBinProject/pod-backend`
> - TSS: `/Users/keanuinterone/Projects/Ajentify/TokenStreamingServer`
> - Ajentify API (AgentLambda — reference only, **no changes needed**): `/Users/keanuinterone/Projects/Ajentify/AgentLambda`
>
> All `path:line` citations below were current at research time; re-verify line
> numbers before editing (the code may have shifted).

---

## 0. Guiding principles & the end-state architecture

The refactor collapses the multi-peer "room" model into **one WebSocket + one
round trip**:

```
┌──────────┐   WSS /ws-realtime (JSON-RPC signaling + events)   ┌─────────────┐
│ pod-app  │ ─── connect_to_realtime_context {sdp_offer} ─────▶ │     TSS     │
│ (Expo)   │ ◀── result {sdp_answer, agent, model, voice} ───── │ /ws-realtime│
│          │ ◀── on_tool_call / on_tool_response ─────────────  │             │
│          │ ◀── on_user_transcript / on_agent_transcript ────  └──────┬──────┘
│          │                                                            │ sideband WS
│  WebRTC  │ ◀════════════ audio peer-to-peer ═══════════════▶  OpenAI Realtime
└──────────┘                                                     (TSS not in audio path)
```

**Key facts that drive the design** (from `token-streaming-server-realtime.md`):
1. The `/ws-realtime` WebSocket carries JSON-RPC **and** all agent events. There is
   **no WebRTC data channel** for events anymore.
2. Exactly **one** client→server call establishes the session:
   `connect_to_realtime_context` with `{ context_id, access_token, sdp_offer }`; the
   `result` contains `{ success, model, voice, sdp_answer, agent }`.
3. Audio is **peer-to-peer client↔OpenAI**. Keep mic capture + remote-audio playback.
4. Server→client events are **fire-and-forget notifications** (no `id`) — the client
   must **never** reply to `on_tool_call`, `on_tool_response`,
   `on_user_transcript`, `on_agent_transcript`, `on_client_side_tool_calls`.
5. The realtime event set is smaller: **no** `calibration_status`, `agent_status`,
   `is_speaking_status`, `speech_detected`, `ai_sentence`, `is_speaking_sentence`,
   `stoped_speaking`, `data_channel_connection_status`, `on_error`.
6. `show_bin` is preserved via `on_tool_call` (`tool_name === "show_bin"`) → bin UI;
   `on_tool_response` → `new_total` points sync. **Data shapes are unchanged.**

**Sequencing:** Do **Phase 1 (server enabling changes) first** because the pod-app
cannot connect until (a) the agent points at a realtime model, and (b) the client
API key is client-scoped to the context. E1 (agent-speaks-first) can land in
parallel but should be deployed before end-to-end testing.

---

## Phase 1 — Server-side enabling changes (do first)

These are specified in `00-overview.md` §"Required enabling changes" (E1/E2/E3).
Reproduced here as concrete steps.

### Step 1.1 — TSS: make the agent speak first over WebRTC (E1)

**Files:**
- `TokenStreamingServer/src/lib/RealtimeConnection.py`
- `TokenStreamingServer/src/handlers/connect_to_realtime_context.py`

**Reference pattern:** `RealtimeTelephonyBridge._trigger_initial_response`
(`TokenStreamingServer/src/lib/RealtimeTelephonyBridge.py:152-161`) — sends a bare
`{"type": "response.create"}` after the session is configured.

1. In `RealtimeConnection.__init__` (`RealtimeConnection.py:46-73`), add a new
   constructor param and store it:
   ```python
   def __init__(
       self,
       context: Context,
       context_dict: dict,
       tools: list[AgentTool],
       instructions: str,
       model: str,
       voice: Optional[str] = None,
       client_peer: Optional[JSONRPCPeer] = None,
       agent_speaks_first: bool = False,   # NEW
   ):
       ...
       self.agent_speaks_first = agent_speaks_first   # NEW
   ```

2. Add a method mirroring the telephony bridge (place near `_send_function_output`,
   which already uses `_send_to_openai` at `RealtimeConnection.py:289-300`; the
   helper `_send_to_openai` is defined at `RealtimeConnection.py:358`):
   ```python
   async def _trigger_initial_response(self):
       """Make the agent speak first once the realtime session is live.

       The session is already configured (instructions + tools) via
       session.update, so a bare `response.create` forces an opening turn
       with no user input -- i.e. the greeting. Its transcript is captured
       like any other agent turn via `response.output_audio_transcript.done`.
       """
       await self._send_to_openai({"type": "response.create"})
   ```

3. In `start_session` (`RealtimeConnection.py:75-90`), after the sideband event
   loop task is created, trigger the greeting when configured:
   ```python
   self._sideband_task = asyncio.create_task(self._sideband_event_loop())

   if self.agent_speaks_first:          # NEW
       await self._trigger_initial_response()

   return sdp_answer
   ```
   > Start the event loop **before** triggering, so the greeting's transcript/tool
   > events are handled.

4. In `connect_to_realtime_context.py`, pass the flag when constructing the
   connection (`connect_to_realtime_context.py:86-94`):
   ```python
   realtime_conn = RealtimeConnection(
       context=context,
       context_dict=context_dict,
       tools=tools,
       instructions=instructions,
       model=llm_model.model,
       voice=voice,
       client_peer=connection.peer,
       agent_speaks_first=agent.agent_speaks_first,   # NEW
   )
   ```
   (`agent.agent_speaks_first` exists on the `Agent` model —
   `TokenStreamingServer/src/Models/Agent.py:24`.)

**Validation for this step:** After deploy, connecting with an `agent_speaks_first`
agent should produce an agent greeting with no user input, and an
`on_agent_transcript` for the greeting. **Watch the greeting-clip risk** noted in
`00-overview.md` E1 (`start_session` runs before the client applies `sdp_answer`).
OpenAI buffers output audio until the peer connection is live, so it should be fine;
if the greeting is clipped in practice, defer the `response.create` to fire on a
suitable OpenAI session/`session.updated` event instead of immediately.

### Step 1.2 — Manifest: realtime model + realtime voice (E2)

**File:** `pod-backend/ajentify/ajentify.json` (the `pod` agent block).

1. Change the model to a realtime model:
   - `"model_id": "gpt-5.2"` → `"model_id": "gpt-realtime"` (`ajentify.json:23`).
   - **Verify** `gpt-realtime` exists in the TSS models table with
     `is_realtime: true` (`TokenStreamingServer/src/Models/LLMModel.py:17`;
     validation gate at `connect_to_realtime_context.py:68-70`). If the id differs
     in the models table, use that id.
2. Add a realtime voice field (owner picks; default `marin`):
   - `"realtime_voice": "marin"` — schema support at
     `AgentLambda/src/RequestHandlers/Deploy/ManifestSchema.py:177-182`; allowed
     values: `alloy, ash, ballad, coral, echo, sage, shimmer, verse, marin, cedar`.
   - Leave the existing `voice_id` (`ajentify.json:21`) as-is — harmless; only used
     by non-realtime TTS.
3. Keep `agent_speaks_first: true` (`ajentify.json:9`) — required for the greeting.
4. **Deploy the manifest** so the agent config updates in Ajentify. (Use the repo's
   existing manifest deploy path — confirm how `ajentify.json` is deployed for
   pod-backend.)

### Step 1.3 — pod-backend: scope the client API key to the context's `client_id` (E3)

**Why:** the realtime handler's strict client-scoped auth requires the
`access_token`'s `client_id` claim to match `context.client_id`
(`connect_to_realtime_context.py:58-62`). Today the pod-backend creates the context
without a `client_id` and mints the key without one, so it falls to the weaker
user-match path. This change makes it deterministic and stable per user.

**No AgentLambda changes needed** — the Ajentify API already accepts/returns
`client_id` on `POST /context` and accepts `client_id` on `POST /generate-api-key`
(see `00-overview.md` E3 for citations).

**File A:** `pod-backend/lambda/api/Models/User.py`
1. Add an optional field to the `User` model (`User.py:19-29`):
   ```python
   class User(BaseModel):
       id: str
       email: str
       name: Optional[str] = None
       council_id: str
       bin_system_id: str
       pod_configuration: str = PodConfiguration.NONE.value
       pod_bin_preferences: Optional[dict] = None
       points: int
       ajentify_client_id: Optional[str] = None   # NEW
       created_at: int
       updated_at: int
   ```
   - Optional/defaulted so existing DynamoDB rows still parse.
   - **Do NOT** add it to `UserResolved` (`User.py:31-41`) — keep it off the
     app-facing shape.
   - `update_user(...)` already patches arbitrary attributes (`User.py:92-100`) — no
     change needed there.

**File B:** `pod-backend/lambda/api/RequestHandlers/Agent/create_agent_context.py`
1. Update the import (`create_agent_context.py:6`):
   ```python
   from Models.User import resolve_user, update_user
   ```
2. Before creating the context, read the existing client id (after `user = payload.user`
   at `create_agent_context.py:16`):
   ```python
   existing_client_id = user.ajentify_client_id
   ```
3. Include `client_id` in the `POST /context` body **only when set**
   (`create_agent_context.py:54-62`):
   ```python
   context_body = {
       "agent_id": agent_id,
       "prompt_args": prompt_args,
       "user_defined": user_defined,
   }
   if existing_client_id:
       context_body["client_id"] = existing_client_id

   context_response = requests.post(
       f"{ajentify_api_url}/context",
       headers=headers,
       json=context_body,
   )
   ```
4. After parsing the response (`create_agent_context.py:67-72`), read + persist the
   client id:
   ```python
   context_data = context_response.json()
   context_id = context_data.get("context_id")
   if not context_id:
       raise Exception("Ajentify context response missing context_id", 502)

   client_id = context_data.get("client_id")            # NEW
   if not client_id:                                    # NEW
       raise Exception("Ajentify context response missing client_id", 502)
   if not existing_client_id:                           # NEW: persist first time
       update_user(user.id, {"ajentify_client_id": client_id})
   ```
5. Add `client_id` to the `POST /generate-api-key` body
   (`create_agent_context.py:76-83`) so the returned key is client-scoped:
   ```python
   api_key_response = requests.post(
       f"{ajentify_api_url}/generate-api-key",
       headers=headers,
       json={
           "org_id": org_id,
           "type": "client",
           "client_id": client_id,   # NEW
       },
   )
   ```
6. Response is unchanged: `{ context_id, client_api_key }`
   (`CreateAgentContextResponse`, `create_agent_context.py:9-11`).

**Net effect:** `POST /create-agent-context` now returns a `client_api_key` whose
`client_id` claim matches the created context — exactly what
`connect_to_realtime_context` needs.

### Step 1.4 — Deploy + verify Phase 1 before touching the app

- Deploy TSS (E1) and pod-backend (E3), and deploy the manifest (E2).
- **Smoke test with a script/curl or existing tooling** if possible: create a
  context via `POST /create-agent-context`, then open `/ws-realtime` and send
  `connect_to_realtime_context` with a dummy/browser-generated SDP offer to confirm
  auth passes and a `sdp_answer` returns. (Full audio needs the app.)
- Confirm the prod `/ws-realtime` host URL to use in Phase 3 (Decision #3:
  e.g. `wss://token-streaming-server.prod.token-streaming.ajentify.com/ws-realtime`).

---

## Phase 2 — pod-app: new realtime transport service

Goal: introduce a single class that owns the `/ws-realtime` WebSocket, the WebRTC
peer connection, the one-shot `connect_to_realtime_context` handshake, and inbound
event dispatch — replacing `RoomConnection`. **Reuse `JSONRPCPeer` and the
media/audio parts of `PeerConnection`.**

### Step 2.1 — Reuse assessment (read before writing)

Reusable **as-is**:
- `src/services/webrtc/JSONRPCPeer.ts` — works over any `sender(message)`. Use it
  with a WebSocket sender. Its `handleMessage` already: treats `{method, params}`
  with an `id` as a request needing a reply, and `{method, params}` **without** `id`
  as a fire-and-forget notification (`JSONRPCPeer.ts:100-135`). This matches the
  realtime contract — notifications won't be replied to. ✅
- `src/services/audio/AudioLevelMonitor.ts` — polls `pc.getStats()`, transport-agnostic. ✅
- `src/components/agentroom/AudioPlayer.tsx` — hidden `RTCView` for remote audio. ✅
- `src/stores/mediadevice.store.ts` — mic permission + `getUserMedia`. ✅

Reusable **with edits**:
- `src/services/webrtc/PeerConnection.ts` — keep mic-out (`:121-125`), remote-audio
  `ontrack` (`:108-119`), and the RTCPeerConnection creation. **Remove the data
  channel** (`:78-105`) — not needed. **Replace ICE servers** (`:50-75`) per Decision
  #4 (STUN-only, drop metered.ca TURN). See Step 2.3.

Delete/replace:
- `src/services/webrtc/RoomConnection.ts` — entirely replaced by the new service
  (Step 2.2). It encodes room/peer-discovery/invite/ICE-trickle which no longer exist.

### Step 2.2 — Create `RealtimeConnection.ts` (new file)

Create `src/services/webrtc/RealtimeConnection.ts`. Responsibilities:

1. Open the `/ws-realtime` WebSocket, wrap it in a `JSONRPCPeer` whose `sender`
   does `ws.send(message)` (mirror `RoomConnection.joinRoom` sender at
   `RoomConnection.ts:64-70`, but pointed at `${realtimeUrl}` directly — the URL
   should already include `/ws-realtime`, see Step 5.1).
2. Register the inbound event handlers on that peer (these are the realtime
   `on_*` methods — the store will provide the callbacks; keep this class transport
   only and forward to injected callbacks, OR register store methods directly — see
   Step 3).
3. Build the WebRTC peer connection:
   - Create `RTCPeerConnection` with STUN-only ICE (Step 2.3).
   - Add the mic track(s) from the provided `MediaStream`.
   - `ontrack` → capture remote audio stream (for `AudioPlayer` + agent audio meter).
   - `createOffer()` → `setLocalDescription(offer)`.
   - **Wait for ICE gathering to complete** (non-trickle): the TSS handshake is
     one-shot with no ICE relay path, so gather candidates into the offer SDP before
     sending. Implement a helper that resolves when `iceGatheringState === "complete"`
     (or after a short timeout) and then reads `pc.localDescription.sdp`.
     > This differs from the old trickle flow (`RoomConnection.configurePeer`
     > `onicecandidate` → `relay_ice_candidate`, `RoomConnection.ts:144-155`) which
     > **no longer exists** on `/ws-realtime`.
4. Send the handshake once the WS is open and the offer is ready:
   ```ts
   const result = await this.rpc.call(
     "connect_to_realtime_context",
     {
       context_id: this.contextId,
       access_token: this.accessToken,   // the client_api_key from create-agent-context
       sdp_offer: this.pc.localDescription.sdp,
     },
     true,          // awaitResponse
     15000,         // generous timeout (SDP exchange + OpenAI session setup)
   );
   ```
   `result` = `{ success, model, voice, sdp_answer, agent }`
   (`connect_to_realtime_context.py:102-108`).
5. Apply the answer: `await pc.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: result.sdp_answer }))`.
6. Expose connection-state via `onconnectionstatechange` (mirror
   `RoomConnection.ts:163-175`), calling a provided `onConnectionStateChanged(connected)`
   callback so the store can set `isConnected`.
7. Provide a `close()` that: closes the `RTCPeerConnection`, stops outbound tracks,
   and closes the WebSocket (mirror `RoomConnection.leaveRoom`, `RoomConnection.ts:296-314`).

**Important JSON-RPC nuance to verify:** `JSONRPCPeer.call(..., awaitResponse=true)`
generates an `id` and parks it in `responseQueue`, then polls (`JSONRPCPeer.ts:59-86`).
The TSS response comes back as `{ id, result }` (`token-streaming-server-realtime.md`
§2.2). `handleMessage` routes `{id, result}` (no `method`) into `responseQueue`
(`JSONRPCPeer.ts:137-144`). This already works. Errors surface as
`result.error` and `call` throws (`JSONRPCPeer.ts:80-82`). ✅

**Suggested shape:**
```ts
export class RealtimeConnection {
  constructor(opts: {
    contextId: string;
    accessToken: string;
    mediaStream: MediaStream;
    onConnectionStateChanged?: (connected: boolean) => void;
    onInboundStreamReceived?: (stream: MediaStream) => void;
    // realtime event callbacks:
    onToolCall?: (p: { tool_call_id: string; tool_name: string; tool_input: any }) => void;
    onToolResponse?: (p: { tool_call_id: string; tool_name: string; tool_output: any }) => void;
    onUserTranscript?: (p: { transcript: string }) => void;
    onAgentTranscript?: (p: { transcript: string }) => void;
    onClientSideToolCalls?: (p: { tool_calls: { tool_call_id: string; tool_name: string; tool_input: any }[] }) => void;
  });
  connect(): Promise<{ agent: any; model: string; voice: string }>;
  get peerConnection(): RTCPeerConnection | undefined;
  get inboundMediaStream(): MediaStream | undefined;
  close(): void;
}
```

> **Client-side tools:** pod tools are all server-side, so `onClientSideToolCalls`
> will not fire in practice. Register a handler anyway that logs (and, if ever
> needed, replies via `client_side_tool_responses` per
> `token-streaming-server-realtime.md` §5). Not required for launch.

### Step 2.3 — ICE configuration (Decision #4)

In the new peer-connection creation (new file, or the reused parts of
`PeerConnection.ts`), replace the metered.ca TURN block (`PeerConnection.ts:50-75`)
with STUN-only:
```ts
this.pc = new RTCPeerConnection({
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
});
```
- **Verify** during testing that a direct client↔OpenAI WebRTC path connects with
  STUN-only on the target networks. If a restrictive network fails, reintroduce a
  TURN server (via env vars, not hardcoded creds).
- Drop `EXPO_PUBLIC_TURN_USERNAME` / `EXPO_PUBLIC_TURN_CREDENTIAL` usage.

### Step 2.4 — Trim `PeerConnection.ts` (if reused) or fold into the new service

Decide one of:
- **(A) Reuse a trimmed `PeerConnection.ts`:** remove `createDataChannel`,
  `dataChannel`, `sendMessage`, `setOnDataChannelMessage`, `ondatachannel`, and the
  `createDataChannel` branch (`PeerConnection.ts:17-19`, `36-38`, `78-105`,
  `128-135`). Keep `initialize()` media plumbing (`:107-126`) and swap ICE (Step 2.3).
- **(B) Fold media plumbing directly into `RealtimeConnection.ts`** and delete
  `PeerConnection.ts`.

Prefer **(A)** if you want minimal churn; **(B)** if you want a single cohesive
transport class. Either is fine — note the choice in the PR description.

---

## Phase 3 — pod-app: refactor `AgentRoomStore`

**File:** `src/stores/agentroom.store.ts`.

Keep the store as the MobX UI integration point and keep the **entire `show_bin`
subsystem unchanged** (queue, timers, reward panel, getters, dismiss). Only change
the transport wiring and the inbound event handlers.

### Step 3.1 — Replace transport wiring in `initialize`

Current `initialize` (`agentroom.store.ts:206-280`) does: media → InCallManager →
`new RoomConnection(...)` → `joinRoom()` → detect agent → `inviteAgent`.

Replace the `RoomConnection`/join/invite block (`agentroom.store.ts:240-271`) with:
1. Create `new RealtimeConnection({...})` (Step 2.2) passing:
   - `contextId`, `accessToken: clientApiKey` (the value already threaded through
     `initialize(contextId, clientApiKey)` — `agentroom.store.ts:206`, called from
     `index.tsx:75`).
   - `mediaStream: this.mediaStream`.
   - `onConnectionStateChanged: (connected) => runInAction(() => { this.isConnected = connected; this.isConnecting = !connected; })`.
   - `onInboundStreamReceived: (stream) => { start the agent audio monitor }` (reuse
     the monitor-start logic currently in `setOnInboundStreamReceived`,
     `agentroom.store.ts:359-373`).
   - The realtime event callbacks → the handlers rewritten in Step 3.2.
2. `await realtimeConnection.connect()`.
3. On success set `isReady = true` (see Step 4 for gating simplification) and start
   the **user** audio monitor off `realtimeConnection.peerConnection` (reuse logic at
   `agentroom.store.ts:384-397`).
4. Keep `mediaDeviceStore.initializeMediaDevices()` + `getMediaStream` +
   `InCallManager.start/setForceSpeakerphoneOn` exactly as-is
   (`agentroom.store.ts:214-238`).
5. **Delete** `inviteAgent` (`agentroom.store.ts:282-312`), `onPeerAdded`
   (`:314-325`), `onConnectionRequest` (`:327-333`), and
   `onPeerAddedOrConnectionRequest` (`:335-401`) — these are the room model. Move any
   still-needed monitor-start code into the new callbacks above.

Store field changes:
- Replace `roomConnection: RoomConnection` (`agentroom.store.ts:48`) with
  `realtimeConnection: RealtimeConnection | undefined`.
- The `agentRPCLayer` field (`agentroom.store.ts:93`) is no longer needed in the
  store (the RPC layer lives inside `RealtimeConnection`). Remove it and its use in
  `reset` (`:163`).
- Update `reset` (`agentroom.store.ts:124-185`) and `leaveRoom`
  (`agentroom.store.ts:735-760`) to call `this.realtimeConnection?.close()` instead
  of `roomConnection.leaveRoom()`.
- Update `toggleMicrophone` (`agentroom.store.ts:696-730`): the loop over
  `roomConnection.peerConnections` (`:718-728`) becomes a single
  `realtimeConnection.peerConnection` outbound-track toggle (or just rely on toggling
  `this.mediaStream` tracks, since there is exactly one peer connection now).

### Step 3.2 — Rewrite inbound event handlers (`setupAgentCallbacks`)

Current handlers are registered in `setupAgentCallbacks`
(`agentroom.store.ts:406-517`) for the legacy event set. In the new model these
become the callbacks passed into `RealtimeConnection` (or methods registered on its
internal RPC peer). Map them as follows:

| Legacy handler (remove) | New realtime handler | Action |
|---|---|---|
| `data_channel_connection_status` (`:409`) | — | Delete. Readiness comes from `onConnectionStateChanged`. |
| `calibration_status` (`:416`) | — | Delete (no calibration). |
| `agent_status` (`:424`) | — | Delete (no lifecycle event). |
| `is_speaking_status` (`:437`) | — | Delete (no user VAD event). Optionally derive `isUserSpeaking` locally from the user `AudioLevelMonitor` if the new UI wants it. |
| `speech_detected` (`:460`) | — | Delete (no partial transcription). |
| `ai_sentence` (`:484`) | — | Delete (no sentence streaming). |
| `is_speaking_sentence` (`:492`) | — | Delete. |
| `stoped_speaking` (`:499`) | — | Delete. |
| `tool_call` (`:508`) | **`on_tool_call`** | Keep behavior: call `agentToolCallHandler(tool_name, tool_input)` (`agentroom.store.ts:523-577`) **unchanged**. |
| `tool_response` (`:513`) | **`on_tool_response`** | Keep behavior: call `agentToolResponseHandler(tool_name, tool_output)` (`agentroom.store.ts:584-596`) **unchanged**. |
| (none) | **`on_user_transcript`** `{ transcript }` | NEW. Append a final user message (see Step 3.3). |
| (none) | **`on_agent_transcript`** `{ transcript }` | NEW. Append a final agent message (see Step 3.3). |

> **Do NOT reply** to any `on_*` events (they are notifications). Since these are
> forwarded via injected callbacks (not `rpc.call`), there's nothing to reply with —
> just handle them.

**`show_bin` stays intact.** `agentToolCallHandler` (`:523-577`) and
`agentToolResponseHandler` (`:584-596`), plus `scheduleNextBinAdvance`,
`finishBinSequence`, `showRewardPanel`, `clearBinAndRewardTimers`,
`dismissActiveOverlay`, and the getters `currentBinColor`/`currentBinType`
(`:113-119`) — **no changes**. Keep `parseToolOutput` (`:22-41`); the realtime
server sends `tool_output` as the tool's raw return (`token-streaming-server-realtime.md`
§4.8.2), so a tolerant parser still applies. **Verify** the actual serialized shape
of `new_total` during testing and keep the parser tolerant.

**Ordering caveat to verify:** realtime sends `on_tool_call` then `on_tool_response`
back-to-back after execution (`token-streaming-server-realtime.md` §4.8, ordering
note). The current store already treats `tool_call` as the UI trigger and
`tool_response` as the points sync, so this is compatible — but confirm the
back-to-back arrival doesn't disturb the 6s-per-bin queue timing (`PER_BIN_MS`,
`agentroom.store.ts:13`) or the reward hand-off.

### Step 3.3 — Transcript state for the reworked conversation UI (Decision #5)

The new server provides only **final** transcripts. Simplify the message state:
- Remove the partial-transcription state machine: `currentDetectedSpeech`,
  `currentUserMessageId`, `userMessageCounter`, `isUserSpeaking`
  (`agentroom.store.ts:62-68`), and the AI-sentence state
  `currentlySpeakingSentenceId` (`:72`).
- Keep a simple append-only history for display:
  - `userMessages: { text: string; message_id: string }[]` — on `on_user_transcript`,
    push `{ text: transcript, message_id: "user-" + Date.now() }`.
  - `aiMessages`: change to `{ text: string; message_id: string }[]` (drop
    `sentence_id`) — on `on_agent_transcript`, push
    `{ text: transcript, message_id: "ai-" + Date.now() }`.
- These feed the (simplified) `TranscriptionDisplay` and `AIMessageDisplay`
  components (Step 4.2).

> This is a **product/UI decision** — final-only transcripts, no live/partial text,
> no "currently speaking sentence" highlight. If the new UI design differs, adjust
> here, but the data available from the server is only the two final-transcript
> events.

---

## Phase 4 — pod-app: UI & readiness gating

**File:** `app/(app)/index.tsx` (+ the display components).

### Step 4.1 — Remove staged readiness gating (Decision #6)

- The realtime connection is effectively instantaneous (no
  `agent_status`/`calibration` lifecycle). Replace the staged status labels
  (`getStatusLabel`, `index.tsx:160-166`) with a simple two-state:
  "Start Conversation" → "Starting…".
- Change the gate `if (!currentContextId || !agentRoomStore.isReady)`
  (`index.tsx:170`): `isReady` should now be set true when
  `RealtimeConnection.connect()` resolves (Step 3.1). Alternatively gate on
  `isConnected`. Remove references to `isTranscriptionReady` / `hasCalibrated`
  (`index.tsx:163-164`).
- Remove `isCalibrating`, `hasCalibrated`, `isTranscriptionReady` from the store
  (`agentroom.store.ts:56-59`) and everywhere they're read/written.

### Step 4.2 — Update conversation UI components

- **Keep unchanged (core):** `BinClassificationView`, `RewardPanel`, `AudioPlayer`,
  `Orb`, `SlideUpView` + `ARLAndRICView` (still driven by `show_arl_and_ric` via the
  unchanged `agentToolCallHandler`). The central-content switch in
  `index.tsx:232-252` (bin → reward → orb) stays as-is.
  - Note the inbound audio stream is read from the (old) `roomConnection.peerConnections[0]`
    at `index.tsx:136-139`; re-point it to
    `agentRoomStore.realtimeConnection?.inboundMediaStream`.
- **Simplify (reworkable):**
  - `AIMessageDisplay` (`src/components/agentroom/AIMessageDisplay.tsx`): drop the
    `currentlySpeakingSentenceId` bold/autoscroll behavior; render `aiMessages` as a
    plain list keyed by `message_id`. Update its props in `index.tsx:224-228`
    (remove `currentlySpeakingSentenceId`).
  - `TranscriptionDisplay` (`src/components/agentroom/TranscriptionDisplay.tsx`): drop
    `currentMessageId` active-highlight; render `userMessages` plainly. Update props in
    `index.tsx:257-260`.
- **Orb:** keep animating off audio levels — agent via the inbound `getStats` monitor,
  user via the outbound monitor (both preserved in Step 3.1). `Orb` already ignores
  `userAudioLevel` internally (`pod-app-current-state.md` §8), so no change required.

### Step 4.3 — Mic mute

`toggleMicrophone` (`agentroom.store.ts:696-730`) — keep toggling
`this.mediaStream` audio tracks; update the peer-track loop to the single
`realtimeConnection.peerConnection` (Step 3.1). UI button in `index.tsx:273-285`
unchanged.

---

## Phase 5 — Config, env, and cleanup

### Step 5.1 — Env vars

**File:** `pod-app/.env` (and any `.env.example`/docs).
- **Add:** `EXPO_PUBLIC_REALTIME_WS_URL=wss://token-streaming-server.prod.token-streaming.ajentify.com/ws-realtime`
  (confirm exact host in Step 1.4; Decision #3). Read it in `RealtimeConnection.ts`.
- **Remove (no longer used):**
  - `EXPO_PUBLIC_SIGNALING_SERVER_URL` (`.env:3`) — room signaling gone.
  - `EXPO_PUBLIC_AGENT_SERVER_URL` (`.env:4`) — `/invite-agent` gone.
  - `EXPO_PUBLIC_TURN_USERNAME` / `EXPO_PUBLIC_TURN_CREDENTIAL` — STUN-only.
  - `EXPO_PUBLIC_AGENT_ID` (`.env:5`) — was already unused in code.
- **Keep:** `EXPO_PUBLIC_API` (`.env:1`) — pod-backend REST base for
  `createAgentContext`.
- Verify all `process.env.EXPO_PUBLIC_*` reads (grep) are updated:
  `RoomConnection.ts:58` (signaling), `agentroom.store.ts:288` (agent server),
  `PeerConnection.ts:57-73` (TURN).

### Step 5.2 — Delete dead code

- Delete `src/services/webrtc/RoomConnection.ts`.
- Delete `src/services/webrtc/PeerConnection.ts` if folding into the new service
  (Step 2.4 option B), else keep trimmed.
- Remove legacy store fields/handlers listed in Steps 3.1–3.3 and 4.1.
- Optional: prune stale docs referencing the old flow
  (`SETUP_GUIDE.md`, `QUICKSTART.md`, `VOICE_CHAT_ENV.md`,
  `IMPLEMENTATION_SUMMARY.md` — `pod-app-current-state.md` §11).

### Step 5.3 — Dependencies

No new dependencies required. `react-native-webrtc`, `react-native-incall-manager`,
`mobx`, `uuid` all remain (`pod-app-current-state.md` §10). WebSocket is the RN
global. Confirm nothing imported only by deleted files leaves an unused dep.

---

## Phase 6 — Testing & validation

Run through these end-to-end after Phase 1 is deployed and Phases 2–5 are done.

1. **Handshake:** Start Conversation → context created (`POST /create-agent-context`
   returns `{context_id, client_api_key}`) → `/ws-realtime` opens →
   `connect_to_realtime_context` resolves with `sdp_answer` → WebRTC connects.
   - Confirm the returned `client_api_key` is client-scoped (E3) and auth passes the
     strict `client_id` path (`connect_to_realtime_context.py:58-62`).
2. **Agent speaks first (E1):** Agent greets with no user input; an
   `on_agent_transcript` arrives for the greeting. **Check for greeting clipping**
   (E1 timing note); if clipped, apply the deferred-`response.create` fallback.
3. **Two-way audio:** User speech is heard by the agent; agent audio plays via
   `AudioPlayer`. Orb animates on agent audio.
4. **`show_bin` (core):** Ask the agent to classify an item →
   `on_tool_call` `show_bin` drives the bin queue (6s/bin) → reward panel when
   `show_reward` → `on_tool_response` `new_total` updates `authStore.user.points`.
   - Multi-bin queue timing intact; back-to-back call+response doesn't break it.
   - Pod vs kerbside rendering intact (uses `authStore.user.pod_configuration`).
5. **`show_arl_and_ric`:** slide-up view still opens.
6. **Transcripts:** final user + agent transcripts render in the simplified UI.
7. **Mic mute** toggles correctly.
8. **Teardown:** End Conversation / unmount closes the WS + PC, stops tracks,
   `InCallManager.stop()`; no leaked timers/monitors (`reset` clears them).
9. **Error paths:** handshake failure returns `result.error` (surface it in
   `contextError`). Mid-session: no `on_error` exists — detect via WebSocket
   `onclose` + `RTCPeerConnection` connection-state changes and reflect a
   disconnected state in the UI (V4 in `00-overview.md`).
10. **Token expiry:** the client key is short-lived (~2 min default); it's minted
    just-in-time by `createAgentContext` right before connecting, so this is fine —
    but confirm no retry path reuses a stale key.

---

## Appendix A — File-by-file change checklist

**TSS** (`/Users/keanuinterone/Projects/Ajentify/TokenStreamingServer`)
- [ ] `src/lib/RealtimeConnection.py` — add `agent_speaks_first` param +
      `_trigger_initial_response()` + call in `start_session`. (E1)
- [ ] `src/handlers/connect_to_realtime_context.py` — pass
      `agent_speaks_first=agent.agent_speaks_first`. (E1)

**pod-backend** (`/Users/keanuinterone/Projects/ReBinProject/pod-backend`)
- [ ] `ajentify/ajentify.json` — `model_id → gpt-realtime`, add `realtime_voice`. (E2)
- [ ] `lambda/api/Models/User.py` — add `ajentify_client_id: Optional[str] = None`. (E3)
- [ ] `lambda/api/RequestHandlers/Agent/create_agent_context.py` — thread
      `client_id` through context create + persist on user + generate-api-key. (E3)

**pod-app** (`/Users/keanuinterone/Projects/ReBinProject/pod-app`)
- [ ] `src/services/webrtc/RealtimeConnection.ts` — **new** transport service.
- [ ] `src/services/webrtc/PeerConnection.ts` — trim data channel + STUN-only ICE
      (or delete if folded in).
- [ ] `src/services/webrtc/RoomConnection.ts` — **delete**.
- [ ] `src/services/webrtc/JSONRPCPeer.ts` — reuse as-is (verify, no edits expected).
- [ ] `src/stores/agentroom.store.ts` — swap transport, rewrite event handlers,
      simplify transcript state, drop calibration/lifecycle state, keep `show_bin`.
- [ ] `app/(app)/index.tsx` — simplify gating, re-point inbound audio stream,
      update component props.
- [ ] `src/components/agentroom/AIMessageDisplay.tsx` — simplify (no speaking-sentence).
- [ ] `src/components/agentroom/TranscriptionDisplay.tsx` — simplify (no active-highlight).
- [ ] `.env` (+ docs) — add `EXPO_PUBLIC_REALTIME_WS_URL`; remove signaling/agent-server/TURN/agent-id.

**Unchanged (verify only):** `BinClassificationView.tsx`, `RewardPanel.tsx`,
`AudioPlayer.tsx`, `Orb.tsx`, `SlideUpView.tsx`, `ARLAndRICView.tsx`,
`AudioLevelMonitor.ts`, `mediadevice.store.ts`, `createcontext.ts`, auth layer.

---

## Appendix B — Realtime wire contract quick reference

**Client → server (send):**
- `connect_to_realtime_context` `{ context_id, access_token, sdp_offer }` (with `id`,
  await `{ success, model, voice, sdp_answer, agent }`).
- `client_side_tool_responses` `{ tool_responses: [{ tool_call_id, response }] }`
  (only if a client-side tool ever fires; pod tools are server-side).

**Server → client (notifications, do NOT reply):**
- `on_tool_call` `{ tool_call_id, tool_name, tool_input }` → **drives `show_bin` / `show_arl_and_ric`**.
- `on_tool_response` `{ tool_call_id, tool_name, tool_output }` → **`new_total` points sync**.
- `on_user_transcript` `{ transcript }` → final user transcript.
- `on_agent_transcript` `{ transcript }` → final agent transcript.
- `on_client_side_tool_calls` `{ tool_calls: [...] }` → not used by pod tools.

Full detail + citations: `token-streaming-server-realtime.md` §8.

---

## Appendix C — Open verification items carried from research

- **V4:** No runtime `on_error` channel. Detect mid-session failure via WS close +
  WebRTC connection-state (Step 6.9).
- **Realtime model id** `gpt-realtime` must exist with `is_realtime: true` in the TSS
  models table (Step 1.2).
- **Greeting clip risk** from E1 timing (Step 1.1 / Step 6.2).
- **STUN-only viability** on target networks (Step 2.3 / Step 6.3).
- **`tool_output` serialized shape** for `new_total` — confirm and keep
  `parseToolOutput` tolerant (Step 3.2).

---

*End of implementation plan. Hand this, plus the three research docs in this folder,
to the implementation agent.*
