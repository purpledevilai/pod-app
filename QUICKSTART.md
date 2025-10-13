# Voice Chat Quick Start

## 🚀 Get Started in 3 Steps

### 1. Configure Environment Variables

Set these environment variables (via `.env` file or your build system):

```bash
EXPO_PUBLIC_SIGNALING_SERVER_URL=ws://your-signaling-server.com
EXPO_PUBLIC_AGENT_SERVER_URL=http://your-agent-server.com
EXPO_PUBLIC_AGENT_ID=your-agent-id
EXPO_PUBLIC_API_BASE_URL=http://your-api-server.com
```

**For local development on physical device**, use your machine's IP instead of localhost:
```bash
EXPO_PUBLIC_SIGNALING_SERVER_URL=ws://192.168.1.100:8080
EXPO_PUBLIC_AGENT_SERVER_URL=http://192.168.1.100:8000
```

### 2. Build Custom Dev Client

```bash
# For iOS (requires Xcode)
npx expo run:ios

# For Android (requires Android Studio)
npx expo run:android
```

⏰ **First build takes 5-10 minutes**. Subsequent builds are much faster.

### 3. Test the Voice Chat

1. Log into the app
2. Tap **"Start Conversation"**
3. Grant microphone permission
4. Wait for connection (watch debug panel at top)
5. Start speaking!

## 📊 What to Watch

**Debug Panel (top of screen) shows:**
- Context ID
- Connection status (Connecting → Connected)
- Calibration status
- Microphone status

**Console logs show:**
- `[AgentRoomStore]` - Main flow
- `[RoomConnection]` - WebRTC signaling
- `[PeerConnection]` - P2P connection

## 🎨 UI Elements

- **Gray Orb** - Idle/waiting
- **Blue Orb** - You're speaking
- **Green Orb** - AI is speaking
- **Text above Orb** - Your transcribed speech
- **Text below Orb** - AI's messages (bold = currently speaking)

## 🔧 Troubleshooting

### Build fails?
```bash
# Clean and rebuild
npx expo prebuild --clean
npx expo run:ios  # or android
```

### Connection fails?
1. Check console logs for errors
2. Verify server URLs are correct and accessible
3. Ensure servers are running
4. Check firewall/network settings

### No audio?
1. Check microphone permission in device settings
2. Look for "Media stream obtained" in logs
3. Verify audio tracks are being added to peer connection

### Agent doesn't join?
1. Check `EXPO_PUBLIC_AGENT_SERVER_URL` is correct
2. Verify agent server is running
3. Check agent server logs

## 📚 More Documentation

- **SETUP_GUIDE.md** - Detailed setup instructions
- **VOICE_CHAT_ENV.md** - Environment variable reference
- **IMPLEMENTATION_SUMMARY.md** - Architecture and implementation details

## 🎯 Happy Path Flow

1. ✅ Environment configured
2. ✅ Custom client built
3. ✅ App running on device/simulator
4. ✅ User logged in
5. ✅ "Start Conversation" tapped
6. ✅ Context created (see context ID in debug panel)
7. ✅ Connecting... (yellow status)
8. ✅ Calibrating... (overlay appears - don't speak!)
9. ✅ Connected (green status)
10. ✅ Speak and see transcription appear
11. ✅ AI responds with audio and text
12. ✅ Conversation flows naturally
13. ✅ "End Conversation" to cleanup

## 💡 Pro Tips

- Use **headphones** to prevent audio feedback
- Check **console logs** for detailed connection info
- The **debug panel** shows real-time status
- **Calibration** (don't speak) improves speech detection
- **Mute** button works even during conversation
- **End Conversation** properly cleans up WebRTC connections

---

**Ready to talk to your AI agent! 🎤**

