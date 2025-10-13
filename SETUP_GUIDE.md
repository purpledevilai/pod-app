# Voice Assistant Setup Guide

This guide will help you set up and run the voice assistant feature in the Pod App.

## Prerequisites

- Node.js and npm installed
- Xcode (for iOS development) or Android Studio (for Android development)
- Expo CLI installed globally: `npm install -g expo-cli`

## Installation Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory based on `.env.example`:

```bash
cp .env.example .env
```

Edit `.env` and fill in your server URLs and agent ID:

```env
EXPO_PUBLIC_SIGNALING_SERVER_URL=ws://your-signaling-server.com
EXPO_PUBLIC_AGENT_SERVER_URL=http://your-agent-server.com
EXPO_PUBLIC_AGENT_ID=your-agent-id
EXPO_PUBLIC_API_BASE_URL=http://your-api-server.com
```

### 3. Build Custom Development Client

The app uses `react-native-webrtc` which requires native modules. You need to build a custom development client:

#### For iOS:

```bash
npx expo run:ios
```

This will:
- Open Xcode
- Build the native modules
- Install the app on the iOS Simulator or connected device
- Start the Metro bundler

#### For Android:

```bash
npx expo run:android
```

This will:
- Use Android Studio's build tools
- Build the native modules
- Install the app on the Android Emulator or connected device
- Start the Metro bundler

**Note:** The first build will take several minutes. Subsequent builds will be faster.

### 4. Running the App (After First Build)

After the initial build, you can use the standard Expo commands:

```bash
# For iOS
npx expo run:ios

# For Android
npx expo run:android
```

The app will automatically reload when you make code changes (hot reload still works!).

## Architecture Overview

### WebRTC Layer (`src/services/webrtc/`)
- **JSONRPCPeer**: Handles JSON-RPC protocol over data channels
- **PeerConnection**: Manages individual WebRTC peer connections
- **RoomConnection**: Manages WebSocket signaling and peer lifecycle

### Stores (`src/stores/`)
- **MediaDeviceStore**: Manages microphone permissions and audio streams
- **AgentRoomStore**: Coordinates the entire voice conversation experience

### Components (`src/components/agentroom/`)
- **Orb**: Visual indicator showing conversation state
- **TranscriptionDisplay**: Shows user's speech transcription
- **AIMessageDisplay**: Shows AI agent's messages
- **AudioPlayer**: Plays inbound audio from agent

### Flow
1. User taps "Start Conversation"
2. App creates a context via API
3. App joins WebRTC room using context ID
4. App invites agent to room
5. Agent joins, WebRTC connection established
6. Voice conversation begins

## Troubleshooting

### Build Issues

**iOS Build Fails:**
- Make sure you have Xcode installed with Command Line Tools
- Try cleaning the build: `cd ios && xcodebuild clean && cd ..`
- Delete `ios/` folder and rebuild: `npx expo prebuild --clean`

**Android Build Fails:**
- Make sure Android Studio and Android SDK are properly installed
- Check that `ANDROID_HOME` environment variable is set
- Try cleaning: `cd android && ./gradlew clean && cd ..`

### WebRTC Connection Issues

**Can't connect to signaling server:**
- Check that `EXPO_PUBLIC_SIGNALING_SERVER_URL` is correct
- Ensure signaling server is running and accessible
- Check network/firewall settings

**Agent doesn't join:**
- Check that `EXPO_PUBLIC_AGENT_SERVER_URL` is correct
- Verify agent server is running
- Check that agent ID is correct

**No audio:**
- Check microphone permissions in device settings
- Verify audio stream is being received (check debug logs)
- Test with different TURN/STUN servers if behind strict NAT

### Permission Issues

**Microphone permission denied:**
- Go to device Settings → Your App → Permissions
- Enable Microphone permission
- Restart the app

## Development Tips

1. **Console Logs**: The app has extensive logging. Check the Metro bundler console for WebRTC connection details.

2. **Debug Info**: The home screen shows connection status and other debug info at the top.

3. **Hot Reload**: Code changes still work with hot reload after the initial build.

4. **Changing Native Config**: If you modify `app.json` or add new native modules, rebuild the custom dev client.

## Next Steps (Future Enhancements)

- [ ] Add audio volume monitoring for reactive orb animation
- [ ] Implement context persistence/reuse
- [ ] Add reconnection logic for network interruptions
- [ ] Add background audio support
- [ ] Implement better error recovery
- [ ] Add UI polish and animations

## Support

For issues or questions, check the console logs first - they provide detailed information about the WebRTC connection process.

