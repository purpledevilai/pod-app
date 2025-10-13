# Environment Variables for Voice Chat

The voice chat feature requires the following environment variables to be set.

All environment variables must be prefixed with `EXPO_PUBLIC_` to be accessible in the app.

## Required Environment Variables

```bash
# WebRTC Signaling Server (WebSocket URL)
# Example: ws://localhost:8080 or wss://signaling.yourserver.com
EXPO_PUBLIC_SIGNALING_SERVER_URL=ws://your-signaling-server.com

# Agent Server (HTTP URL)  
# This server hosts the AI agent and handles agent invitations
# Example: http://localhost:8000 or https://agent.yourserver.com
EXPO_PUBLIC_AGENT_SERVER_URL=http://your-agent-server.com

# Default Agent ID
# The ID of the agent that users will connect to
EXPO_PUBLIC_AGENT_ID=your-agent-id

# API Base URL (for creating contexts)
# This should match the base URL in your API client config
# Example: http://localhost:3000/api or https://api.yourserver.com
EXPO_PUBLIC_API_BASE_URL=http://your-api-server.com
```

## Optional Environment Variables

These have defaults but can be customized:

```bash
# TURN Server Username (for NAT traversal)
EXPO_PUBLIC_TURN_USERNAME=your-turn-username

# TURN Server Credential
EXPO_PUBLIC_TURN_CREDENTIAL=your-turn-credential
```

## How to Set Environment Variables

### Method 1: Using .env file (Development)

Create a `.env` file in the project root:

```env
EXPO_PUBLIC_SIGNALING_SERVER_URL=ws://localhost:8080
EXPO_PUBLIC_AGENT_SERVER_URL=http://localhost:8000
EXPO_PUBLIC_AGENT_ID=default-agent
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
```

### Method 2: Using eas.json (EAS Build)

Add to your `eas.json`:

```json
{
  "build": {
    "development": {
      "env": {
        "EXPO_PUBLIC_SIGNALING_SERVER_URL": "ws://your-server.com",
        "EXPO_PUBLIC_AGENT_SERVER_URL": "http://your-server.com",
        "EXPO_PUBLIC_AGENT_ID": "agent-id",
        "EXPO_PUBLIC_API_BASE_URL": "http://your-api.com"
      }
    }
  }
}
```

### Method 3: Using app.config.js (Dynamic Config)

Create `app.config.js`:

```javascript
export default {
  expo: {
    // ... other config
    extra: {
      signalingServerUrl: process.env.EXPO_PUBLIC_SIGNALING_SERVER_URL,
      agentServerUrl: process.env.EXPO_PUBLIC_AGENT_SERVER_URL,
      agentId: process.env.EXPO_PUBLIC_AGENT_ID,
      apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
    }
  }
}
```

## Testing Configuration

To verify your environment variables are set correctly:

1. Check the console logs when the app starts - they will show the configured URLs
2. The home screen debug info will show connection status
3. Look for `[AgentRoomStore]` logs in the console

## Common Issues

**Variables not loading:**
- Make sure variable names start with `EXPO_PUBLIC_`
- Restart Metro bundler after changing .env file
- Clear cache: `npx expo start --clear`

**Connection failures:**
- Verify URLs are accessible from your device/emulator
- Use `ws://` not `wss://` for local development
- Use your machine's IP address instead of `localhost` when testing on physical devices

