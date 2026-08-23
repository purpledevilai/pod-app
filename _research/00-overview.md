# Pod App Realtime Refactor — Research Overview & Index

> **Goal of the refactor (context, not a plan):** Migrate the ReBin `pod-app`
> (React Native / Expo) off the legacy "agent server" WebRTC/room integration and
> onto the Ajentify **TokenStreamingServer** realtime endpoint `/ws-realtime`, which
> fronts OpenAI realtime models. We CANNOT use the Ajentify voice SDK (it doesn't
> support RN/Expo), but the existing integration already uses `react-native-webrtc`,
> so we reuse the installed WebRTC + WebSocket primitives. The essential product
> behavior to preserve is the agent-driven **bin classification view** (`show_bin`)
> and the **points/reward** flow. Conversational/status UI (transcription lists, AI
> sentence streaming, calibration, orb states) can be reworked for a new UI.
>
> This document is an **index + synthesis** of two deep-dive research docs written
> by separate research passes. It is intended to be picked up by a fresh planning
> agent. Nothing here is a proposed solution — it is a factual snapshot + mapping.

---

## Research documents in this folder

1. [`pod-app-current-state.md`](./pod-app-current-state.md) — how the pod-app
   *currently* works: room-based WebRTC signaling, the `agentroom.store.ts` event
   handling, the `show_bin` flow, the UI component map, dependencies, and a
   "what changes vs. what stays" summary. Repo: `/Users/keanuinterone/Projects/ReBinProject/pod-app`.
2. [`token-streaming-server-realtime.md`](./token-streaming-server-realtime.md) —
   how the **new** target works: the `/ws-realtime` JSON-RPC handshake, the
   `connect_to_realtime_context` request/`sdp_answer` response, `RealtimeConnection`
   (SDP exchange with OpenAI, sideband WS, `session.update`), and the complete
   server→client event set. Repo: `/Users/keanuinterone/Projects/Ajentify/TokenStreamingServer`.

Read those for exact `path:line` citations and code snippets. The sections below
synthesize the two into the mapping a planner needs.

---

## The core architectural shift

| Aspect | Current (agent server) | New (`/ws-realtime`) |
|---|---|---|
| Signaling | WebSocket to `room-signaling-server` `/ws`, JSON-RPC `join`/`request_connection`/`relay_ice_candidate` | Single WebSocket to TSS `/ws-realtime`; one JSON-RPC request `connect_to_realtime_context` carrying the SDP offer |
| Who the WebRTC peer is | The AI **agent** joins the "room" as a peer (invited via agent server `POST /invite-agent`) | The client peers **directly with OpenAI** (TSS proxies the SDP; audio is peer-to-peer client↔OpenAI, TSS is not in the audio path) |
| SDP exchange | Multi-step room signaling (offer → answer over signaling WS, plus ICE trickle) | One shot: client sends `sdp_offer` in `connect_to_realtime_context`, gets `sdp_answer` back in the JSON-RPC result |
| Event channel | WebRTC **data channel** named `"chat"` (second JSON-RPC layer) | The `/ws-realtime` **WebSocket itself** (server→client JSON-RPC notifications). No app data channel needed. |
| Interruption/turn-taking | Handled by the agent server (calibration, VAD events) | `server_vad` on OpenAI; barge-in/truncation automatic over WebRTC. No client handling needed. |
| Auth to connect | `context_id` (room id) + `client_api_key` (used for `/invite-agent`) | `context_id` + `access_token` (short-lived client-scoped API key whose `client_id` claim must match the context) sent inside `connect_to_realtime_context` |
| Text streaming | Sentence-level `ai_sentence` + token-ish updates | None. Only **final** transcripts (`on_user_transcript`, `on_agent_transcript`). No token/sentence streaming. |

**Bottom line for the planner:** the entire `RoomConnection` room/peer-discovery/
invite layer collapses into a single `/ws-realtime` WebSocket + one
`connect_to_realtime_context` round trip. `PeerConnection` (mic capture, remote
audio playback via `RTCView`/`AudioPlayer`, ICE) is largely reusable; the SDP is
just exchanged differently. `JSONRPCPeer` is reusable as the `/ws-realtime`
message layer. The event handlers in `agentroom.store.ts` must be re-pointed to
the new event set.

---

## Event mapping: old pod-app events → new realtime events

The new realtime event set is smaller and different. See
`token-streaming-server-realtime.md` §8 and `pod-app-current-state.md` §3.

| Current pod-app inbound event (data channel) | New realtime equivalent (`/ws-realtime`) | Notes for planning |
|---|---|---|
| `data_channel_connection_status` | (none) — use WebSocket open + WebRTC connection state | Connection readiness is derived from WS + `RTCPeerConnection` state, not an event. |
| `calibration_status` | **(none)** | No calibration exists on the realtime server. Remove/rework the "Calibrating..." gating. |
| `agent_status` (waking_up/calibrating/ready) | (none) | No lifecycle event. "Ready" ≈ `connect_to_realtime_context` resolved + WebRTC connected. Rework `isReady` gating. |
| `is_speaking_status` (user VAD) | (none) | No user-VAD event. If needed for UI, derive locally from mic audio level (`AudioLevelMonitor`). |
| `speech_detected` (partial user text) | (none) — only final `on_user_transcript` | No partial/live user transcription. Only a final `{ transcript }` after the user's turn. |
| `ai_sentence` / `is_speaking_sentence` / `stoped_speaking` | (none) — only final `on_agent_transcript` | No sentence streaming or "currently speaking sentence" highlight. Only a final `{ transcript }`. |
| `tool_call` `{ tool_name, tool_input }` | `on_tool_call` `{ tool_call_id, tool_name, tool_input }` | **This is how `show_bin` is preserved.** Same conceptual trigger; params add `tool_call_id`. |
| `tool_response` `{ tool_name, tool_output }` | `on_tool_response` `{ tool_call_id, tool_name, tool_output }` | Carries `new_total` for points sync. Note ordering caveat below. |
| (n/a — pod-app has no client-side tools) | `on_client_side_tool_calls` `{ tool_calls: [...] }` | Not needed unless a tool is marked `is_client_side_tool`. Pod tools are all server-side. |
| (n/a) | `on_user_transcript` `{ transcript }` | NEW. Final user transcript — feeds any reworked transcription UI. |
| (n/a) | `on_agent_transcript` `{ transcript }` | NEW. Final agent transcript — feeds any reworked AI-message UI. |

### Key preserved flow: `show_bin`

- `show_bin` is a **server-side** tool (all pod-backend tools are
  `is_client_side_tool: false`). On the realtime server, server-side tools emit
  **`on_tool_call` then `on_tool_response`** back-to-back after execution
  (`token-streaming-server-realtime.md` §4.8.1–4.8.2).
- So the planner maps: `on_tool_call` with `tool_name === "show_bin"` →
  trigger the existing bin-queue animation with `tool_input`
  `{ bins:[{type,color}], show_reward, points }`; `on_tool_response` with
  `tool_name === "show_bin"` → parse `tool_output` and sync `new_total` into
  `authStore.user.points`. Data shapes are unchanged (`pod-app-current-state.md` §6).
- **Ordering caveat:** unlike the current agent server, the realtime server sends
  `on_tool_call` and `on_tool_response` **both after** the tool has already
  executed (back-to-back). The current pod-app already treats `tool_call` as the
  UI trigger and `tool_response` as the points sync, so this remains compatible —
  but the planner should confirm the ~back-to-back arrival doesn't disrupt the
  6s-per-bin queue timing (`PER_BIN_MS`) or the reward hand-off.
- **`tool_output` parsing quirk:** the current pod-app tolerates Python-repr
  strings (`parseToolOutput`). The realtime server sends `tool_output` as the
  tool's raw return (string or JSON-serializable). Confirm the actual serialized
  shape `new_total` arrives in and keep a tolerant parser.

---

## What is reusable in the pod-app as-is

- `react-native-webrtc@^124.0.7`: `RTCPeerConnection`, `mediaDevices.getUserMedia`,
  `RTCView`, `RTCSessionDescription`, `RTCIceCandidate`.
- `PeerConnection.ts` mic-track-out + `ontrack` agent-audio-in + `AudioPlayer.tsx`
  hidden `RTCView` playback + `InCallManager` speaker routing — the audio plumbing.
- `JSONRPCPeer.ts` — reuse as the `/ws-realtime` WebSocket JSON-RPC layer (request
  with `id` for `connect_to_realtime_context`; treat incoming `method`+`params`
  with no `id` as fire-and-forget notifications and **do not reply**).
- MobX `AgentRoomStore` as the UI integration point — re-point its handlers.
- Auth/context creation via pod-backend, but see open questions on tokens.
- `BinClassificationView`, `RewardPanel` and their data shapes — the core to keep.

---

## Decisions (resolved with product owner)

1. **Realtime auth token — use the existing `client_api_key`.** The pod-backend
   `POST /create-agent-context` already returns a short-lived client key
   (`client_api_key`) alongside `context_id`
   (`pod-backend/lambda/api/RequestHandlers/Agent/create_agent_context.py:74-98`).
   The plan is to send this as the `access_token` in `connect_to_realtime_context`.
   → **See verification item V1 below** — there is a real auth-shape nuance to
   confirm before relying on this.
2. **Agent/model config — owner will set `model_id` to a realtime model.** The
   ReBin agent is fully defined in `pod-backend/ajentify/ajentify.json`. Currently
   `model_id: "gpt-5.2"` (`ajentify.json:23`); the owner will change it to
   `gpt-realtime`. Tools (`show_bin`, `show_arl_and_ric`, `set_user_name`,
   `set_pod_bin_preferences`, `sort_item`) are all server-side
   (`is_client_side_tool: false`) — no client-side tool handling needed in the app.
3. **`/ws-realtime` host — prod TSS.** Point the app at the prod token-streaming
   host (e.g. `wss://token-streaming-server.prod.token-streaming.ajentify.com/ws-realtime`)
   via a new `EXPO_PUBLIC_*` env var, replacing the old signaling/agent-server vars.
4. **ICE/TURN — STUN-only / whatever OpenAI's realtime WebRTC needs.** Drop the
   hardcoded metered.ca TURN creds; use STUN-only (verify OpenAI's requirements for
   the direct client↔OpenAI WebRTC path).
5. **Conversation UI — show final user + agent transcripts.** Feed the reworked
   transcription/AI-message UI from `on_user_transcript` + `on_agent_transcript`
   (final transcripts only; no partial/sentence streaming). The `Orb` can still
   animate off local audio levels (agent audio via `getStats`, user via mic).
   `stoped_speaking`/`is_speaking_sentence` sentence-highlight features are removed.
6. **Ready-gating — removed.** The realtime connection is effectively instantaneous
   (no `agent_status`/`calibration` lifecycle). Drop the staged
   "Waking pod up… / Calibrating… / Getting ready…" gating; readiness is just
   "connected" (WebSocket open + WebRTC connected).

## Required enabling changes (pre-work — NOT yet implemented)

> These are agreed with the product owner but **deliberately not implemented yet**.
> They are prerequisites/enablers that the planning agent should sequence ahead of
> (or alongside) the pod-app client refactor. Each is spec'd concretely with exact
> files + line references so it can be executed directly. **Repos:** TSS =
> `/Users/keanuinterone/Projects/Ajentify/TokenStreamingServer`; pod-backend =
> `/Users/keanuinterone/Projects/ReBinProject/pod-backend`; manifest lives in
> `/Users/keanuinterone/Projects/ReBinProject/pod-backend/ajentify/ajentify.json`.

### E1 — TSS: make the agent speak first over realtime WebRTC (`agent_speaks_first`)

**Why:** The pod must greet the user first. The manifest sets
`agent_speaks_first: true` (`ajentify.json:9`) and the TSS `Agent` model already
carries `agent_speaks_first` (`TokenStreamingServer/src/Models/Agent.py:24`). The
legacy `/ws` path honors it, but the realtime path does **not**: `RealtimeConnection.start_session`
sends `session.update` then waits for user speech (server_vad) with **no initial
`response.create`** (`token-streaming-server-realtime.md` §4.3).

**Pattern to mirror:** `RealtimeTelephonyBridge._trigger_initial_response`
(`TokenStreamingServer/src/lib/RealtimeTelephonyBridge.py:152-161`) — it simply
sends `{"type": "response.create"}` after the session is configured, forcing an
opening turn with no user input. The greeting transcript is then captured normally
via `response.output_audio_transcript.done` → `on_agent_transcript`.

**Concrete changes:**
1. `TokenStreamingServer/src/lib/RealtimeConnection.py`
   - Add an `agent_speaks_first: bool = False` constructor param (alongside the
     existing params at `:46-55`) and store `self.agent_speaks_first`.
   - Add a `_trigger_initial_response()` method that awaits
     `self._send_to_openai({"type": "response.create"})` (mirror the telephony
     bridge's method + docstring).
   - In `start_session` (`:75-90`), after `_send_session_update()` and after the
     sideband event-loop task is created, `if self.agent_speaks_first: await
     self._trigger_initial_response()`. (Start the event loop first so the greeting's
     transcript/tool events are handled.)
2. `TokenStreamingServer/src/handlers/connect_to_realtime_context.py`
   - Pass `agent_speaks_first=agent.agent_speaks_first` into the `RealtimeConnection(...)`
     construction (`:86-94`).

**Timing note for the planner to validate:** `start_session` runs inside
`connect_to_realtime_context` **before** the client applies the `sdp_answer`, so the
greeting is generated before the browser/native peer connection is fully live.
OpenAI's realtime WebRTC buffers output audio until the peer connection is
established, so this should be fine, but confirm the greeting isn't clipped in
practice; if it is, defer the `response.create` slightly (e.g. trigger on a suitable
OpenAI session event) rather than immediately after `session.update`.

### E2 — Manifest: point the pod agent at a realtime model + set a realtime voice

**Why:** `connect_to_realtime_context` rejects non-realtime models; and the realtime
path uses `agent.realtime_voice` (default `"marin"`), NOT `voice_id`
(`connect_to_realtime_context.py:83`). The current manifest has `model_id: "gpt-5.2"`
(`ajentify.json:23`) and only an ElevenLabs-style `voice_id` (`ajentify.json:21`).

**Concrete changes (in `pod-backend/ajentify/ajentify.json`, `pod` agent block):**
- Change `"model_id": "gpt-5.2"` → `"model_id": "gpt-realtime"` (owner-confirmed
  realtime model id; must exist in the TSS models table with `is_realtime: true`).
- Add `"realtime_voice": "<voice>"`. The manifest schema supports this field
  (`AgentLambda/src/RequestHandlers/Deploy/ManifestSchema.py:177-182`); allowed
  values: `alloy, ash, ballad, coral, echo, sage, shimmer, verse, marin, cedar`.
  **Owner to pick the voice** (default `marin` if unspecified). `voice_id` can stay
  as-is (harmless; only used by non-realtime TTS).
- The agent keeps the same logical name/stage, so nothing else in the manifest or
  its runtime addressing changes.

### E3 — pod-backend: scope the client API key to the context's `client_id`

**Why (resolves the auth nuance):** For realtime auth to use the strict
client-scoped path, the client `access_token` must carry a `client_id` claim that
matches `context.client_id` (`token-streaming-server-realtime.md` §3.2). Today
`create_agent_context.py` creates the context without a `client_id` and mints the
client key via `/generate-api-key` with only `{ org_id, type: "client" }`
(`create_agent_context.py:52-91`) — so the key has **no** `client_id` claim and the
realtime handler falls back to `user_id` matching. We want deterministic client
scoping instead, and a stable per-user client identity.

**Good news — no Ajentify API (AgentLambda) changes needed.** The API already:
- accepts `client_id` on `POST /context` (`Models.Context.CreateContextParams.client_id`;
  authenticated flow validates + attaches it — `AgentLambda/src/RequestHandlers/Context/CreateContextHandler.py:139-165`), and
- **returns** `client_id` in the context response (`CreateContextResponse` extends
  `FilteredContext`, which includes `client_id` — `CreateContextHandler.py:39-47`,
  `184-188`), and
- accepts `client_id` on `POST /generate-api-key` for `type: "client"`
  (`AgentLambda/src/RequestHandlers/APIKey/GenerateAPIKeyHandler.py:12-19`, `52-59`).

**Concrete changes (owner-approved design):**
1. `pod-backend/lambda/api/Models/User.py`
   - Add `ajentify_client_id: Optional[str] = None` to the `User` model
     (`Models/User.py:19-29`). (Optional/defaulted so existing rows still parse;
     keep it OFF `UserResolved` so it isn't exposed to the app.)
   - `update_user(...)` already supports patching arbitrary attributes
     (`Models/User.py:92-100`) — no change needed there.
2. `pod-backend/lambda/api/RequestHandlers/Agent/create_agent_context.py`
   - Import `update_user` alongside `resolve_user` (currently
     `from Models.User import resolve_user` at `:6`).
   - Before creating the context, read `existing_client_id = user.ajentify_client_id`.
   - Include `"client_id": existing_client_id` in the `POST /context` body **only when
     it is set** (`:54-62`).
   - After parsing the response, read `client_id = context_data.get("client_id")`
     (raise 502 if missing). If `existing_client_id` was empty, persist it:
     `update_user(user.id, {"ajentify_client_id": client_id})`.
   - Add `"client_id": client_id` to the `POST /generate-api-key` body (`:76-83`) so
     the returned `client_api_key` is scoped to that client.
   - The endpoint response is unchanged: `{ context_id, client_api_key }`.

**Net effect:** the pod-app keeps calling `POST /create-agent-context` and receives a
`client_api_key` that is now a **client-scoped** token whose `client_id` matches the
context — which the pod-app then sends as the `access_token` in
`connect_to_realtime_context`. (See "Decisions" #1.)

## Remaining verification items for the planning/implementation phase

- **V4 — No `on_error` at runtime.** The realtime server does not forward OpenAI
  errors to the client. Handshake failures surface as `result.error` on the
  `connect_to_realtime_context` response; mid-session failures must be detected via
  WebSocket close + WebRTC connection-state changes.
- **Realtime model id** `gpt-realtime` must exist in the TSS models table with
  `is_realtime: true` (`TokenStreamingServer/src/Models/LLMModel.py:9-23`) — verify
  before/at deploy.
- **Greeting clip risk** from E1's timing note — validate during implementation.

---

*This overview indexes and synthesizes the two research docs in this folder for a
downstream planning agent. See those docs for full detail and citations.*
