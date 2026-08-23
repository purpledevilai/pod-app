# Ajentify TokenStreamingServer — Realtime (WebRTC) Client Path

> Source-of-truth research for implementing a **React Native (Expo) WebRTC realtime client** against the Ajentify TokenStreamingServer (TSS).
> Read-only research pass. All citations use `path:line` relative to repo root
> `/Users/keanuinterone/Projects/Ajentify/TokenStreamingServer`.

---

## 1. Top Summary

The TSS exposes **two** WebSocket endpoints (`src/app.py:60`, `src/app.py:78`):

- `/ws` — **legacy** token-streaming (non-realtime) JSON-RPC path. Text-in, token-stream-out (`on_token`/`on_stop_token`). NOT used for realtime audio.
- `/ws-realtime` — **new realtime WebRTC path** (the one this doc covers). The WebSocket is used only as a **JSON-RPC signaling + event channel**; the actual audio flows **peer-to-peer over WebRTC** directly between the client and OpenAI's realtime servers.

The realtime flow in one paragraph: the client opens a WebSocket to `/ws-realtime`, then sends a single `connect_to_realtime_context` JSON-RPC **request** carrying `context_id`, `access_token`, and an `sdp_offer`. The server authenticates, resolves the agent/context/tools, validates the model is a realtime model, POSTs the SDP offer to OpenAI's realtime **calls** API to obtain an `sdp_answer` + `call_id`, opens a **sideband** WebSocket to OpenAI (server↔OpenAI) to configure the session and relay events/tools, and returns the `sdp_answer` in the JSON-RPC **result**. The browser/native client applies the answer (`setRemoteDescription`) and audio starts flowing over WebRTC. The `/ws-realtime` WebSocket then stays open so the server can push **AI events** (transcripts, tool calls) to the client via server→client JSON-RPC calls, and so the client can return **client-side tool results** via `client_side_tool_responses`.

There is a **separate Twilio telephony realtime path** (`/incoming-call-realtime/{agent_id}` + `/media-stream-realtime` + `RealtimeTelephonyBridge`) that is **NOT** the client path — documented briefly for contrast in §10.

Key files:
- `src/app.py` — endpoint registration + handler wiring.
- `src/lib/Connection.py` — per-WebSocket connection wrapper.
- `src/lib/JSONRPCPeer.py` — JSON-RPC framing/dispatch.
- `src/handlers/connect_to_realtime_context.py` — the realtime connect handler.
- `src/lib/RealtimeConnection.py` — the core realtime session (SDP exchange, sideband WS, session config, event fan-out to client, tool routing).
- `src/handlers/realtime_client_side_tool_responses.py` — client→server tool result return path.
- `src/LLM/RealtimeToolConverter.py`, `src/LLM/AgentTool.py`, `src/Models/Tool.py` — tool schema + client/server-side distinction.

---

## 2. WebSocket Transport + JSON-RPC Framing

### 2.1 Connection lifecycle (`src/lib/Connection.py`)

Each WebSocket is wrapped in a `Connection` (`src/lib/Connection.py:10`):

- On construction it creates a `JSONRPCPeer(sender=self.send)` (`src/lib/Connection.py:14`) where `send` just does `websocket.send_text(message)` (`src/lib/Connection.py:26-27`).
- `Connection` holds realtime state: `self.realtime_connection: Optional[RealtimeConnection]` (`src/lib/Connection.py:24`).
- `start()` accepts the socket then runs `receive_loop()` (`src/lib/Connection.py:54-57`).
- `receive_loop()` reads text frames and forwards each raw message to `self.peer.handle_message(message)` (`src/lib/Connection.py:29-37`).
- `connection.on(method, handler)` registers a handler; it **wraps** the handler so `connection_id=self.id` is injected as a kwarg alongside the JSON-RPC params (`src/lib/Connection.py:39-43`). This is why every handler signature starts with `connection_id`.
- `connection.call(method, params, await_response=False, timeout=5)` delegates to the peer to send a server→client message (`src/lib/Connection.py:45-52`).

The endpoint registers the realtime connection in a global `CONNECTIONS` dict keyed by `connection.id` (`src/app.py:80-84`), and on teardown calls `realtime_connection.close()` then removes it (`src/app.py:88-92`).

### 2.2 Message framing (`src/lib/JSONRPCPeer.py`)

This is a JSON-RPC-**like** protocol (not strictly 2.0 — no `jsonrpc` field). Every frame is a JSON object sent as a WebSocket text frame.

**Request / notification (either direction):**
```json
{ "method": "method_name", "params": { ... }, "id": "uuid-or-null" }
```
- A request is identified by having BOTH `method` and `params` keys (`src/lib/JSONRPCPeer.py:64`).
- If `id` is present/truthy → the receiver runs the handler and sends back a **response** with the same `id` (`src/lib/JSONRPCPeer.py:72-89`).
- If `id` is missing/falsy → it is treated as a **notification** (fire-and-forget): the handler is awaited and NO response is sent (`src/lib/JSONRPCPeer.py:72-74`).

**Response:**
```json
{ "id": "same-id", "result": { ... } }
```
- On success: `{ "id", "result": <handler return value> }` (`src/lib/JSONRPCPeer.py:77-81`).
- On handler exception: `{ "id", "result": { "error": "<str(e)>" } }` (`src/lib/JSONRPCPeer.py:82-89`). **Note: errors are nested inside `result.error`, not a top-level JSON-RPC `error` object.**
- A message with an `id` that is NOT in the local `response_queue` and no `method` is logged as unknown and dropped (`src/lib/JSONRPCPeer.py:92-96`).

### 2.3 Outbound calls (server→client) and whether responses are expected

`JSONRPCPeer.call(method, params, await_response=False, timeout=5)` (`src/lib/JSONRPCPeer.py:22-54`):
- Generates a `msg_id = uuid` **only if** `await_response=True`, else `id=None` (`src/lib/JSONRPCPeer.py:30`).
- Sends `{ method, params, id }` (`src/lib/JSONRPCPeer.py:32-38`).
- If `await_response=False` → returns immediately, expecting **no** response (`src/lib/JSONRPCPeer.py:40-41`).
- If `await_response=True` → parks the id in `response_queue` and polls via `till_true(...)` until a response arrives or `timeout` (default 5s), raising `TimeoutError` on timeout (`src/lib/JSONRPCPeer.py:43-46`). If the response `result.error` is set it raises (`src/lib/JSONRPCPeer.py:50-52`).

**Critical for the client implementation:** In the realtime path, EVERY server→client call is made with the default `await_response=False` (see `RealtimeConnection` — `self.client_peer.call(method=..., params=...)` at `src/lib/RealtimeConnection.py:234-241`, `260-269`, `309-312`, `321-324`). Therefore:

> The server does **NOT** send an `id` on realtime server→client events, and does **NOT** expect the client to reply to any of them. These are pure notifications. The client must NOT send JSON-RPC responses for `on_tool_call`, `on_tool_response`, `on_client_side_tool_calls`, `on_user_transcript`, or `on_agent_transcript`.

The only client→server response-style traffic in realtime is:
1. The **response** to the client's own `connect_to_realtime_context` request (server replies with the `sdp_answer`).
2. The client-initiated `client_side_tool_responses` request (client may include an `id` to get a `{ "success": true }` ack — see §5).

### 2.4 Handler registration for `/ws-realtime` (`src/app.py:78-92`)

```78:92:src/app.py
@app.websocket("/ws-realtime")
async def websocket_realtime_endpoint(websocket: WebSocket):
    connection = Connection(websocket)
    CONNECTIONS[connection.id] = connection

    connection.on("connect_to_realtime_context", connect_to_realtime_context)
    connection.on("client_side_tool_responses", realtime_client_side_tool_responses)

    try:
        await connection.start()
    finally:
        if connection.realtime_connection:
            await connection.realtime_connection.close()
        CONNECTIONS.pop(connection.id, None)
        print(f"[Realtime Connection {connection.id}] Removed from registry")
```

Only **two** client→server methods are registered on `/ws-realtime`:
- `connect_to_realtime_context`
- `client_side_tool_responses`

(Contrast: `/ws` registers `connect_to_context`, `add_message`, `stop_invocation`, `set_last_messages`, `client_side_tool_responses` — `src/app.py:65-69`. None of `add_message`/`stop_invocation`/`set_last_messages` exist on the realtime endpoint.)

---

## 3. The `connect_to_realtime_context` Handler

File: `src/handlers/connect_to_realtime_context.py`.

### 3.1 Signature / required params

```9:14:src/handlers/connect_to_realtime_context.py
async def connect_to_realtime_context(
    connection_id: str,
    context_id: str,
    sdp_offer: str,
    access_token: str = None,
):
```

`connection_id` is injected by `Connection.on` (§2.1). The client-supplied `params` object must contain:

| param | required | notes |
|---|---|---|
| `context_id` | yes | UUID of the context. Raises `"No context_id provided"` if `None` (`:28-29`). |
| `sdp_offer` | yes | The client's WebRTC SDP offer (string). Raises `"sdp_offer required"` if empty (`:31-32`). |
| `access_token` | yes (defaulted None but enforced) | API key or Cognito token. Raises `"access_token required"` if missing (`:25-26`). |

### 3.2 Auth resolution (API key vs Cognito, client_id scoping)

Mirrors the legacy `connect_to_context` auth (`:34-66`):

1. If `APIKey.validate_api_key(access_token)` is true → it's an **API key** (`:38-49`):
   - Extract contents; `user_id` = `key_contents["user_id"]`.
   - If `user_id == "public"` → synthesize a `public` User with no orgs (`:41-47`).
   - Else load the real user (`:48-49`).
2. Else → treat as a **Cognito** token: `Cognito.get_user_from_cognito(access_token)` then `User.get_user(cognito_user.sub)` (`:50-52`).

Then load the context (`:54`) and authorize (`:56-66`):
- If the API key carries a `client_id` claim (`key_client_id`), require `context.client_id == key_client_id` else raise `"API key client_id does not match context", 403`; resolve the agent by `context.agent_id` (`:58-62`). **This is the primary client-scoped path** for a browser/native end-user token.
- Otherwise (Cognito user / legacy client key without a `client_id` claim): resolve the agent via `Agent.get_agent_for_user`, and require `context.user_id == "public"` OR `context.user_id == user.user_id` else raise `"Context does not belong to user", 403` (`:63-66`).

### 3.3 Realtime-model validation

```68:70:src/handlers/connect_to_realtime_context.py
    llm_model = get_model(context.model_id or agent.model_id)
    if not llm_model or not llm_model.is_realtime:
        raise Exception("Agent model is not a realtime model")
```
`is_realtime` is a field on the LLM model definition (`src/Models/LLMModel.py:17`). The model used is `context.model_id` if set, else `agent.model_id`.

### 3.4 Tool resolution (agent tools + context additional tools + MCP)

```72:80:src/handlers/connect_to_realtime_context.py
    agent_tool_ids = agent.tools if agent.tools else []
    context_tool_ids = context.additional_agent_tools if context.additional_agent_tools else []
    combined_tool_ids = list(dict.fromkeys(agent_tool_ids + context_tool_ids))
    tools = [Tool.get_agent_tool_with_id(tool_id) for tool_id in combined_tool_ids] if combined_tool_ids else []

    # Append tools sourced from the agent's + context's MCP connections
    combined_mcp_connection_ids = (agent.mcp_connections or []) + (context.additional_mcp_connections or [])
    tools += MCPConnection.get_agent_tools_for_connection_ids(combined_mcp_connection_ids)
```
- Combines `agent.tools` + `context.additional_agent_tools`, dedup + order-preserving via `dict.fromkeys`.
- Each id is resolved to an `AgentTool` via `Tool.get_agent_tool_with_id` (`src/Models/Tool.py:159`). Registry tools and DynamoDB tools are both supported; **client-side tools resolve to a no-op function** server-side (`src/Models/Tool.py:183-193`).
- MCP-connection tools are appended.

### 3.5 Session creation + SDP exchange + return shape

```82:108:src/handlers/connect_to_realtime_context.py
    context_dict = context.model_dump()
    voice = agent.realtime_voice or "marin"
    instructions = render_prompt_args(agent.prompt, agent.prompt_arg_names, context_dict)

    realtime_conn = RealtimeConnection(
        context=context,
        context_dict=context_dict,
        tools=tools,
        instructions=instructions,
        model=llm_model.model,
        voice=voice,
        client_peer=connection.peer,
    )

    # Open the OpenAI session and complete the SDP exchange in one shot.
    sdp_answer = await realtime_conn.start_session(sdp_offer)

    connection.context = context
    connection.realtime_connection = realtime_conn

    return {
        "success": True,
        "model": llm_model.model,
        "voice": voice,
        "sdp_answer": sdp_answer,
        "agent": agent.model_dump(),
    }
```

The `client_peer=connection.peer` wiring is what lets `RealtimeConnection` push events straight back to this client's WebSocket.

**Exact result object shape** (delivered as the JSON-RPC response `result` to the client's `connect_to_realtime_context` request):

| field | type | notes |
|---|---|---|
| `success` | bool | always `True` on success |
| `model` | string | resolved OpenAI realtime model id (`llm_model.model`) |
| `voice` | string | resolved voice (`agent.realtime_voice or "marin"`) |
| `sdp_answer` | string | the WebRTC SDP answer; client calls `setRemoteDescription` with this |
| `agent` | object | full `agent.model_dump()` (see `src/Models/Agent.py`) |

On any raised exception, the client instead receives `{ "id": <same>, "result": { "error": "<message>" } }` (§2.2).

---

## 4. `RealtimeConnection` In Depth

File: `src/lib/RealtimeConnection.py`.

### 4.1 Constants / config

```14:23:src/lib/RealtimeConnection.py
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
OPENAI_REALTIME_URL = "wss://api.openai.com/v1/realtime"
OPENAI_REALTIME_CALLS_URL = "https://api.openai.com/v1/realtime/calls"

DEFAULT_REALTIME_VOICE = "marin"
INPUT_TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe"
```

### 4.2 Construction (`:46-73`)

- Stores context, context_dict, instructions, model, voice, and `client_peer` (the client's `JSONRPCPeer`).
- Converts tools once: `self.openai_tools, self.tool_lookup = convert_tools_for_realtime(tools)` (`:63`). Note: for the browser/native path client-side tools are **kept** (not excluded), so they appear in OpenAI's tool list and can be relayed to the client.
- Tracks `_pending_client_tool_calls: dict[call_id -> (name, args)]` so the full exchange can be persisted once the client returns a result (`:71-73`).

### 4.3 `start_session(sdp_offer)` (`:75-90`)

Orchestrates the whole setup in one call (invoked by the handler):
1. Create an aiohttp `ClientSession` (`:80`).
2. `_exchange_sdp(sdp_offer)` → `(sdp_answer, call_id)` (`:82-83`).
3. `_open_sideband(call_id)` (`:85`).
4. `_send_session_update()` (`:86`).
5. Spawn `_sideband_event_loop()` as a background task (`:88`).
6. Return `sdp_answer` (`:90`).

> **`agent_speaks_first` is NOT honored on the realtime path (as of this research).**
> `start_session` configures the session and then waits for user speech (server_vad);
> there is no initial `response.create`, so the agent does not greet first — unlike the
> Twilio bridge, which calls `_trigger_initial_response` (a bare `response.create`) on
> stream start (`src/lib/RealtimeTelephonyBridge.py:152-161`). The pod agent needs
> greeting-first, so an agreed **enabling change** adds this to the WebRTC path gated on
> `agent.agent_speaks_first` — see `00-overview.md` §"Required enabling changes" → E1.

### 4.4 SDP exchange with OpenAI (`_exchange_sdp`, `:92-117`)

- POST to `https://api.openai.com/v1/realtime/calls?model=<model>` (`:99`).
- Headers: `Authorization: Bearer <OPENAI_API_KEY>`, `Content-Type: application/sdp` (`:94-97`).
- Body = the raw SDP offer string (`:101-105`).
- Accepts HTTP 200 or 201; otherwise raises with the body (`:106-108`).
- `sdp_answer = await resp.text()` (`:110`).
- **`call_id` is parsed from the `Location` response header** — the last path segment: `location.split("/")[-1]` (`:111-112`). Raises if empty (`:114-115`).

### 4.5 Sideband WebSocket (`_open_sideband`, `:119-130`)

- Connects to `wss://api.openai.com/v1/realtime?call_id=<call_id>` (`:121`).
- Header: `Authorization: Bearer <OPENAI_API_KEY>` (`:122-124`).
- This sideband WS is the **server↔OpenAI control channel** (audio itself is peer-to-peer via WebRTC; the sideband only carries events + tool I/O + session config).

### 4.6 `session.update` config (`_send_session_update`, `:132-160`)

```134:158:src/lib/RealtimeConnection.py
        event = {
            "type": "session.update",
            "session": {
                "type": "realtime",
                "model": self.model,
                "instructions": self.instructions,
                "tools": self.openai_tools,
                "tool_choice": "auto",
                "audio": {
                    "input": {
                        "turn_detection": {"type": "server_vad"},
                        "transcription": {"model": INPUT_TRANSCRIPTION_MODEL},
                    },
                    "output": {
                        "voice": self.voice,
                    },
                },
            },
        }
```

- **Turn detection**: `server_vad` — OpenAI drives automatic turn detection and, over WebRTC, automatic barge-in / truncation of the model's audio when the user starts speaking. Per the class docstring, no manual barge-in handling is needed client- or server-side for WebRTC (`:39-43`).
- **Input transcription**: `gpt-4o-mini-transcribe` — required to get `conversation.item.input_audio_transcription.*` events (they are OFF by default).
- **Voice**: `agent.realtime_voice or "marin"`.
- **Tools / tool_choice**: the converted OpenAI tool list, `tool_choice: "auto"`.

### 4.7 Sideband event loop + OpenAI event routing (`:162-195`)

`_sideband_event_loop` reads text frames off the sideband and dispatches JSON to `_handle_openai_event` (`:162-175`). Routing (`_handle_openai_event`, `:177-195`):

| OpenAI event type | server action |
|---|---|
| `response.function_call_arguments.done` | `_handle_function_call` → server-side exec OR relay to client (`:181-182`) |
| `conversation.item.input_audio_transcription.completed` | `_handle_user_transcript` → persist + `on_user_transcript` to client (`:184-185`) |
| `response.output_audio_transcript.done` | `_handle_agent_transcript` → persist + `on_agent_transcript` to client (`:187-188`) |
| `response.done` | no-op / `pass` (`:190-191`) |
| `error` | logged only; **not** forwarded to the client (`:193-194`) |

> Note: there is NO `on_error`, `on_token`, `on_stop_token`, `on_turn_complete`, or `on_events` emitted on the realtime path. OpenAI `error` events are only printed server-side.

### 4.8 Client-bound events (server→client) — COMPLETE REFERENCE

Every one of these is sent via `self.client_peer.call(method=..., params=...)` with `await_response=False` (fire-and-forget notification; no `id`, no reply expected). Audio is NOT sent over this channel — it's WebRTC peer-to-peer.

#### 4.8.1 `on_tool_call`
Emitted for a **server-side** tool, immediately before its result, only if a `client_peer` exists (`src/lib/RealtimeConnection.py:233-237`). Triggered by OpenAI `response.function_call_arguments.done` for a non-client-side tool.

```234:237:src/lib/RealtimeConnection.py
                await self.client_peer.call(
                    method="on_tool_call",
                    params={"tool_call_id": call_id, "tool_name": tool.name, "tool_input": arguments}
                )
```
Params: `{ tool_call_id: string, tool_name: string, tool_input: object }`.

#### 4.8.2 `on_tool_response`
Emitted right after `on_tool_call`, once the server-side tool returns (`:238-241`).
```238:241:src/lib/RealtimeConnection.py
                await self.client_peer.call(
                    method="on_tool_response",
                    params={"tool_call_id": call_id, "tool_name": tool.name, "tool_output": result}
                )
```
Params: `{ tool_call_id: string, tool_name: string, tool_output: any }` (`tool_output` is the tool's raw return; often a string or JSON-serializable object).

> Ordering caveat: both `on_tool_call` and `on_tool_response` are sent **after** the tool has already executed (the `await tool.function(...)` at `:231` precedes both). So for server-side tools the client effectively receives call + response back-to-back.

#### 4.8.3 `on_client_side_tool_calls`
Emitted for a **client-side** tool — the server relays the call to the client to execute (`_relay_client_side_tool_call`, `:250-269`). Triggered by OpenAI `response.function_call_arguments.done` for a tool whose `is_client_side_tool` is true.
```260:269:src/lib/RealtimeConnection.py
        await self.client_peer.call(
            method="on_client_side_tool_calls",
            params={
                "tool_calls": [{
                    "tool_call_id": call_id,
                    "tool_name": name,
                    "tool_input": arguments,
                }],
            }
        )
```
Params: `{ tool_calls: [ { tool_call_id: string, tool_name: string, tool_input: object } ] }`.
- Note the params is a **list** `tool_calls`, but the realtime path emits exactly **one** call per event (one per OpenAI `function_call_arguments.done`). The list shape mirrors the legacy `/ws` batch shape.
- Before emitting, the server stashes `_pending_client_tool_calls[call_id] = (name, arguments)` (`:258`) so it can persist the exchange when the client returns the result.
- If there is no `client_peer`, the server immediately sends an error function_output to OpenAI instead (`:252-254`).

#### 4.8.4 `on_user_transcript`
Emitted when OpenAI finishes transcribing the user's speech (`_handle_user_transcript`, `:302-312`). Triggered by `conversation.item.input_audio_transcription.completed`.
```309:312:src/lib/RealtimeConnection.py
            await self.client_peer.call(
                method="on_user_transcript",
                params={"transcript": transcript},
            )
```
Params: `{ transcript: string }`. Empty/whitespace transcripts are dropped (`:304-306`). The transcript is also persisted as a `HumanMessage` (`:307`).

#### 4.8.5 `on_agent_transcript`
Emitted when the agent's spoken response transcript is done (`_handle_agent_transcript`, `:314-324`). Triggered by `response.output_audio_transcript.done`.
```321:324:src/lib/RealtimeConnection.py
            await self.client_peer.call(
                method="on_agent_transcript",
                params={"transcript": transcript},
            )
```
Params: `{ transcript: string }`. Empty/whitespace dropped (`:316-318`). Persisted as an `AIMessage` (`:319`).

### 4.9 Server-side tool execution detail (`_execute_server_side_tool`, `:219-248`)

- Builds params from arguments; if `tool.pass_context` → refreshes `user_defined` from DB and injects `context` (`:224-226`); if `tool.is_async` → injects `tool_call_id` (`:228-229`).
- `await tool.function(**params)` (`:231`).
- Emits `on_tool_call` + `on_tool_response` to client (if `client_peer`) (`:233-241`).
- On exception, result becomes an error string (`:243-244`).
- Persists the exchange (`_save_tool_exchange`, `:326-337`) and sends `function_call_output` back to OpenAI + `response.create` (`_send_function_output`, `:289-300`).

### 4.10 Persistence (`:326-356`)

Tool exchanges and transcripts are appended to the context in DynamoDB, off the event loop via `asyncio.to_thread`, re-reading the context first to avoid clobbering concurrent updates. Stored in the same shape as the non-realtime pipeline (AIMessage tool_call + ToolMessage pair). Not directly relevant to the client wire contract but explains why transcripts persist across reconnects.

### 4.11 Teardown (`close`, `:363-378`)

Cancels the sideband task, closes the sideband WS + aiohttp session. Called from the endpoint `finally` block (`src/app.py:88-90`).

---

## 5. Client-Side Tool Response Return Path

The client executes a client-side tool locally, then sends the result back so the server can forward it to OpenAI.

### 5.1 Client → server method: `client_side_tool_responses`

Registered on `/ws-realtime` to `realtime_client_side_tool_responses` (`src/app.py:84`).

Handler (`src/handlers/realtime_client_side_tool_responses.py`):
```4:19:src/handlers/realtime_client_side_tool_responses.py
async def realtime_client_side_tool_responses(connection_id: str, tool_responses: list):
    connection = CONNECTIONS.get(connection_id)
    realtime_conn = connection.realtime_connection if connection else None
    if not realtime_conn:
        raise Exception("No realtime connection established.")

    if not tool_responses:
        raise Exception("No tool_responses provided")

    await realtime_conn.handle_client_side_tool_responses(tool_responses)

    return {"success": True}
```

**Client request shape** the client must send:
```json
{
  "method": "client_side_tool_responses",
  "params": {
    "tool_responses": [
      { "tool_call_id": "<id from on_client_side_tool_calls>", "response": "<string result>" }
    ]
  },
  "id": "optional-if-you-want-an-ack"
}
```
- `params.tool_responses` = list of `{ tool_call_id, response }`.
- Include an `id` to receive `{ "id": ..., "result": { "success": true } }`; omit it to fire-and-forget.

### 5.2 Forwarding to OpenAI (`handle_client_side_tool_responses`, `src/lib/RealtimeConnection.py:271-287`)

```271:287:src/lib/RealtimeConnection.py
    async def handle_client_side_tool_responses(self, tool_responses: list[dict]):
        for response in tool_responses:
            tool_call_id = response.get("tool_call_id", "")
            output = response.get("response", "")

            name, arguments = self._pending_client_tool_calls.pop(
                tool_call_id, ("", {})
            )
            await self._save_tool_exchange(tool_call_id, name, arguments, output)

            await self._send_function_output(tool_call_id, output)
```
For each response: pop the stashed `(name, args)`, persist the full exchange, then `_send_function_output(tool_call_id, output)` which sends a `conversation.item.create` (`function_call_output`) to OpenAI followed by `response.create` (`:289-300`). So the model receives the client's tool output and continues speaking.

**Per-field:** `tool_call_id` must match the id from the `on_client_side_tool_calls` event; `response` is the string output (stored/forwarded verbatim).

---

## 6. Server-Side vs Client-Side Tool Distinction

### 6.1 The flag

`is_client_side_tool` is a boolean on both the persisted `Tool` model (`src/Models/Tool.py:30`) and the runtime `AgentTool` (`src/LLM/AgentTool.py:15`). When a tool is resolved, a client-side tool gets a **no-op server function** (`src/Models/Tool.py:183-193`):
```183:193:src/Models/Tool.py
    if tool.is_client_side_tool:
        async def client_side_noop(**kwargs):
            return ""
        return AgentTool(
            tool_id=tool_id,
            name=tool.name,
            description=tool.description or "",
            schema=schema,
            function=client_side_noop,
            is_client_side_tool=True,
        )
```

### 6.2 Conversion to OpenAI realtime tool schema (`src/LLM/RealtimeToolConverter.py`)

`convert_tools_for_realtime(tools, exclude_client_side=False)` returns `(openai_tools, tool_lookup)`:
```32:40:src/LLM/RealtimeToolConverter.py
        openai_tools.append({
            "type": "function",
            "name": tool.name,
            "description": tool.description,
            "parameters": schema,
        })
        tool_lookup[tool.name] = tool

    return openai_tools, tool_lookup
```
- Each tool → `{ type: "function", name, description, parameters: <schema> }`.
- `exclude_client_side=True` drops client-side tools entirely (used ONLY by telephony where there's no client — `src/lib/RealtimeTelephonyBridge.py:49-51`). For the browser/native client path, `exclude_client_side` defaults to False, so client-side tools ARE offered to the model (`src/lib/RealtimeConnection.py:63`).
- `_prepare_schema` (`:43-58`) deep-copies the schema and, for `pass_context` tools, strips the injected `context` property/required entry so the model never sees it.

### 6.3 Routing decision at call time (`_handle_function_call`, `src/lib/RealtimeConnection.py:196-217`)

```207:217:src/lib/RealtimeConnection.py
        tool = self.tool_lookup.get(name)
        if not tool:
            output = json.dumps({"error": f"Unknown tool: {name}"})
            await self._save_tool_exchange(call_id, name, arguments, output)
            await self._send_function_output(call_id, output)
            return

        if tool.is_client_side_tool:
            await self._relay_client_side_tool_call(call_id, name, arguments)
        else:
            await self._execute_server_side_tool(call_id, tool, arguments)
```

Summary of what the client sees per tool type:

| tool type | server behavior | client events |
|---|---|---|
| **server-side** (`is_client_side_tool=False`) | executes `tool.function(...)` server-side (Lambda / registry / MCP), sends result to OpenAI | `on_tool_call` then `on_tool_response` (informational only) |
| **client-side** (`is_client_side_tool=True`) | relays to client, waits for `client_side_tool_responses`, forwards to OpenAI | `on_client_side_tool_calls` (client MUST reply via `client_side_tool_responses`) |
| **unknown name** | sends `{"error": "Unknown tool: <name>"}` to OpenAI | none |

---

## 7. End-to-End Sequence (Realtime Handshake + Event Flow)

1. **Obtain credentials** (out of band, HTTP): client has a `context_id` and an `access_token` (client-scoped API key / `client_api_key`, or a Cognito token). See §9.
2. **Open WebSocket** to `wss://<host>/ws-realtime` (`src/app.py:78`). Server accepts and registers the connection (`src/lib/Connection.py:54-56`).
3. **Client builds a WebRTC peer connection**, adds its mic audio track, creates an SDP **offer**, and `setLocalDescription(offer)`.
4. **Client sends** JSON-RPC request:
   ```json
   {"method":"connect_to_realtime_context","params":{"context_id":"...","access_token":"...","sdp_offer":"<sdp>"},"id":"connect-1"}
   ```
5. **Server**: authenticates + authorizes (§3.2), loads agent/context/tools (§3.4), validates realtime model (§3.3), constructs `RealtimeConnection` with `client_peer` (`src/handlers/connect_to_realtime_context.py:86-94`).
6. **Server ↔ OpenAI SDP exchange**: POST offer to `…/v1/realtime/calls?model=…`, get `sdp_answer` + `call_id` from `Location` header (`src/lib/RealtimeConnection.py:92-117`).
7. **Server opens sideband WS** `wss://api.openai.com/v1/realtime?call_id=…` (`:119-130`) and sends `session.update` (instructions, tools, server_vad, transcription, voice) (`:132-160`).
8. **Server responds** to the client's request with `{ success, model, voice, sdp_answer, agent }` (`src/handlers/connect_to_realtime_context.py:102-108`).
9. **Client** applies `setRemoteDescription(sdp_answer)`. WebRTC ICE completes → **audio flows peer-to-peer** between client and OpenAI. (The TSS is NOT in the audio path.)
10. **During the conversation** (over the still-open `/ws-realtime` WS, server→client notifications):
    - User speaks → OpenAI `input_audio_transcription.completed` → server sends `on_user_transcript` (`:302-312`).
    - Agent speaks → OpenAI `output_audio_transcript.done` → server sends `on_agent_transcript` (`:314-324`).
    - Model calls a server-side tool → server executes it, sends `on_tool_call` + `on_tool_response`, returns output to OpenAI (`:219-248`).
    - Model calls a client-side tool → server sends `on_client_side_tool_calls` (`:250-269`); **client executes locally** and replies with `client_side_tool_responses` (§5); server forwards output to OpenAI and triggers the next response.
11. **Teardown**: closing the WebSocket triggers `realtime_connection.close()` (`src/app.py:88-90`), which tears down the sideband WS/session.

---

## 8. Reference Tables

### 8.1 Client → Server methods (realtime `/ws-realtime`)

| method | params | id/response | result on success | source |
|---|---|---|---|---|
| `connect_to_realtime_context` | `{ context_id: string, sdp_offer: string, access_token: string }` | send `id`; server responds | `{ success:true, model:string, voice:string, sdp_answer:string, agent:object }` | `src/handlers/connect_to_realtime_context.py:9-108` |
| `client_side_tool_responses` | `{ tool_responses: [ { tool_call_id: string, response: string } ] }` | `id` optional | `{ success:true }` | `src/handlers/realtime_client_side_tool_responses.py:4-19` |

### 8.2 Server → Client events (realtime) — all fire-and-forget notifications (NO `id`, no reply)

| method | params shape | triggered by (OpenAI event) | source |
|---|---|---|---|
| `on_tool_call` | `{ tool_call_id: string, tool_name: string, tool_input: object }` | `response.function_call_arguments.done` (server-side tool) | `src/lib/RealtimeConnection.py:234-237` |
| `on_tool_response` | `{ tool_call_id: string, tool_name: string, tool_output: any }` | after server-side tool executes | `src/lib/RealtimeConnection.py:238-241` |
| `on_client_side_tool_calls` | `{ tool_calls: [ { tool_call_id: string, tool_name: string, tool_input: object } ] }` | `response.function_call_arguments.done` (client-side tool) | `src/lib/RealtimeConnection.py:260-269` |
| `on_user_transcript` | `{ transcript: string }` | `conversation.item.input_audio_transcription.completed` | `src/lib/RealtimeConnection.py:309-312` |
| `on_agent_transcript` | `{ transcript: string }` | `response.output_audio_transcript.done` | `src/lib/RealtimeConnection.py:321-324` |

That is the **complete** set of realtime server→client methods (verified by grepping all `client_peer.call` sites in `src/lib/RealtimeConnection.py`; no others exist).

---

## 9. Auth Token Minting — What the Client Needs to Connect

To connect the client needs two things: a `context_id` and an `access_token`.

- **`context_id`**: created via the REST API (`POST /context`, out of scope here — handled elsewhere in the platform). A context carries `agent_id`, `user_id` (or `"public"`), and optional `client_id` (`src/Models/Context.py:20-46`). For a public agent, `POST /context` returns a `client_api_key` (per the legacy docs `src/docs/WEBSOCKET_API.md:104`).
- **`access_token`**: an Ajentify API key (JWT) or a Cognito token.
  - **Client-scoped API key** (the typical browser/native case): minted by `APIKey.create_client_api_key(org_id, user_id, client_id, expires_in=2min default)` (`src/Models/APIKey.py:60-107`). The JWT contents include `type:"client"`, `user_id`, and (if provided) a `client_id` claim (`:75-82`). **Short-lived** (default 2 minutes → also the DynamoDB TTL). The realtime handler enforces that this `client_id` claim matches `context.client_id` (§3.2, `src/handlers/connect_to_realtime_context.py:58-62`).
  - **Org API key**: 100-year token, `type:"org"`, `user_id == api_key_id` (`src/Models/APIKey.py:25-58`). Not client-scoped.
  - **Cognito token**: resolved to a user; authorized against `context.user_id` (`connect_to_realtime_context.py:63-66`).
- **`client_id`**: an org's end-user identifier (`src/Models/Client.py:13-27`, auto-generated via `create_client` or supplied via `register_client`). It ties a context + client-scoped token together so a public/end-user session is properly scoped.

Practical minimal path for an Expo client: obtain a `context_id` + a short-lived client `access_token` (whose `client_id` claim matches the context's `client_id`) from the app's own backend, then connect to `/ws-realtime`. Because the client token expires in ~2 minutes by default, mint it just before connecting.

---

## 10. Twilio Telephony Path (Contrast Only — NOT the client path)

- Entry: `POST/GET /incoming-call-realtime/{agent_id}` returns TwiML that opens a Twilio Media Stream to `wss://<host>/media-stream-realtime`, passing `context_id` + a short-lived `access_token` as `<Parameter>`s (`src/app.py:194-223`).
- `/media-stream-realtime` (`src/app.py:226-304`) validates the token (JWT + `client_id` must match context, `:249-260`), loads agent/context/tools, and constructs a `RealtimeTelephonyBridge` (`src/lib/RealtimeTelephonyBridge.py`).
- Key differences from the client path:
  - Audio is **server-mediated** (Twilio ↔ TSS ↔ OpenAI over a server WebSocket), NOT peer-to-peer WebRTC. Both sides speak g711 µ-law 8kHz, forwarded untouched (`src/lib/RealtimeTelephonyBridge.py:22-32`).
  - `convert_tools_for_realtime(tools, exclude_client_side=True)` — **client-side tools are dropped** because there's no client to run them (`:49-51`).
  - No `client_peer`, so **none** of the `on_*` client events are emitted; tools run server-side only.
  - There is manual barge-in handling (the bridge buffers audio), unlike WebRTC where OpenAI handles it.
- Context/token creation for calls: via org webhook (`create_context` + `generate_access_token`) or an intermediary fallback (`src/app.py:99-191`; docs `src/docs/REALTIME_TELEPHONY_WEBHOOK.md`).

---

## 11. Differences vs Legacy `/ws`

Legacy `/ws` protocol is documented in `src/docs/WEBSOCKET_API.md`. Comparing wire contracts:

### 11.1 Client → server methods
| method | `/ws` (legacy) | `/ws-realtime` |
|---|---|---|
| `connect_to_context` | yes (`src/app.py:65`) | — (replaced by `connect_to_realtime_context`) |
| `connect_to_realtime_context` | — | yes (`src/app.py:83`) |
| `add_message` | yes (`src/app.py:66`) | **NO** (audio is spoken, not typed) |
| `stop_invocation` | yes (`src/app.py:67`) | **NO** (server_vad handles interruption) |
| `set_last_messages` | yes (`src/app.py:68`) | **NO** |
| `client_side_tool_responses` | yes (`src/app.py:69`) | yes (`src/app.py:84`, different handler) |

### 11.2 Server → client events
Legacy `/ws` emits: `on_token`, `on_stop_token`, `on_tool_call`, `on_tool_response`, `on_client_side_tool_calls`, `on_events`, `on_turn_complete`, `on_error` (see `src/docs/WEBSOCKET_API.md` and the grep of `connection.peer.call` sites in `src/handlers/add_message.py`, `connect_to_context.py`, `set_last_messages.py`, `client_side_tool_responses.py`).

**Legacy notifications that DO NOT exist in realtime:**
- `on_token` — no token streaming (audio is peer-to-peer; you only get the final `on_agent_transcript`).
- `on_stop_token` — no token stream to terminate.
- `on_events` — realtime never emits custom events.
- `on_turn_complete` — not emitted in realtime.
- `on_error` — realtime does NOT forward OpenAI errors to the client (they are only logged server-side at `src/lib/RealtimeConnection.py:193-194`).

**Shared between both** (same method name; realtime params match the legacy shapes):
- `on_tool_call`, `on_tool_response`, `on_client_side_tool_calls`.

**NEW in realtime (not in legacy `/ws`):**
- `on_user_transcript` — `{ transcript }` (`src/lib/RealtimeConnection.py:309-312`).
- `on_agent_transcript` — `{ transcript }` (`src/lib/RealtimeConnection.py:321-324`).

### 11.3 No "calibration" event anywhere
Confirmed by repo-wide search for `calibrat` in `TokenStreamingServer` → **no matches**. There is no calibration event/method in either path.

---

## 12. Implementation Notes for a React Native (Expo) WebRTC Client

- Use a WebRTC library (e.g. `react-native-webrtc`) to create the peer connection, add the mic track, `createOffer`, `setLocalDescription`, then send the offer SDP as `sdp_offer` inside `connect_to_realtime_context`.
- The `/ws-realtime` WebSocket is only signaling + events; keep it open for the whole session. Audio does not traverse it.
- Implement a small JSON-RPC layer:
  - Outbound request with a generated `id` for `connect_to_realtime_context` (await the `result` containing `sdp_answer`).
  - Message dispatcher: if incoming has `id` + `result` → resolve a pending request; if incoming has `method` + `params` and NO `id` → it's a server notification (handle `on_*`), and **do not reply**.
- After receiving `sdp_answer`, call `setRemoteDescription`. Play remote audio track for the agent's voice.
- For client-side tools: on `on_client_side_tool_calls`, execute each `tool_calls[i]` locally and send back `client_side_tool_responses` with `tool_responses: [{ tool_call_id, response }]` (stringify non-string results).
- Use `on_user_transcript` / `on_agent_transcript` to render the live conversation transcript UI. Do NOT expect token-by-token streaming.
- Mint the client `access_token` right before connecting (default 2-minute expiry).
- Errors: the handshake failure comes back as `result.error` on the `connect_to_realtime_context` response; there is no runtime `on_error` channel — monitor the WebSocket close and WebRTC connection state for mid-session failures.
