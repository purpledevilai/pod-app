import { AIMessageDisplay } from '@/src/components/agentroom/AIMessageDisplay';
import { ARLAndRICView } from '@/src/components/agentroom/ARLAndRICView';
import { AudioPlayer } from '@/src/components/agentroom/AudioPlayer';
import { SlideUpView } from '@/src/components/agentroom/SlideUpView';
import { TranscriptionDisplay } from '@/src/components/agentroom/TranscriptionDisplay';
import { Orb } from '@/src/components/Orb';
import { Button } from '@/src/components/ui/Button';
import { Text } from '@/src/components/ui/Text';
import { useStores } from '@/src/providers/StoreProvider';
import { useTheme } from '@/src/providers/ThemeProvider';
import { createDefaultAgentContext } from '@/src/services/api/context/createcontext';
import { observer } from 'mobx-react-lite';
import { useEffect, useRef, useState } from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';

/**
 * Home Screen - Main voice conversation interface
 * Handles context creation, WebRTC connection, and conversation UI
 */
export default observer(function Home() {
  const { agentRoomStore, authStore } = useStores();
  const { colors } = useTheme();
  const [isCreatingContext, setIsCreatingContext] = useState(false);
  const [contextError, setContextError] = useState<string | undefined>();
  const [currentContextId, setCurrentContextId] = useState<string | undefined>();
  const hasInitialized = useRef(false);

  // Reset on unmount
  useEffect(() => {
    return () => {
      if (currentContextId) {
        console.log('[Home] Component unmounting, cleaning up...');
        agentRoomStore.leaveRoom();
      }
    };
  }, [currentContextId, agentRoomStore]);

  /**
   * Start a new conversation
   * Creates context and initializes WebRTC connection
   */
  const handleStartConversation = async () => {
    try {
      setIsCreatingContext(true);
      setContextError(undefined);
      hasInitialized.current = true;

      console.log('[Home] Creating context...');
      console.log('[Home] User profile:', JSON.stringify(authStore.user));
      const context = await createDefaultAgentContext({
        user_data: JSON.stringify(authStore.user)
      });
      console.log('[Home] Context created:', context.context_id);

      setCurrentContextId(context.context_id);

      console.log('[Home] Initializing agent room...');
      await agentRoomStore.initialize(context.context_id);
      console.log('[Home] Agent room initialized successfully');

    } catch (error) {
      console.error('[Home] Error starting conversation:', error);
      setContextError(
        error instanceof Error
          ? error.message
          : 'Failed to start conversation'
      );
      hasInitialized.current = false;
    } finally {
      setIsCreatingContext(false);
    }
  };

  /**
   * End the current conversation
   * Cleans up WebRTC connection and resets state
   */
  const handleEndConversation = () => {
    console.log('[Home] Ending conversation...');
    agentRoomStore.leaveRoom();
    setCurrentContextId(undefined);
    hasInitialized.current = false;
    setContextError(undefined);
  };

  /**
   * Toggle microphone mute
   */
  const handleToggleMicrophone = () => {
    agentRoomStore.toggleMicrophone();
  };

  /**
   * Dismiss the slide-up view
   */
  const handleDismissSlideUpView = () => {
    agentRoomStore.slideUpViewShouldShow = false;
  };

  /**
   * Render the appropriate content for the slide-up view
   */
  const renderSlideUpContent = () => {
    switch (agentRoomStore.slideUpViewContentType) {
      case 'arl_and_ric':
        return <ARLAndRICView />;
      default:
        return null;
    }
  };

  // Get inbound audio stream from first peer connection
  const inboundAudioStream = currentContextId && agentRoomStore.roomConnection
    ? Object.values(agentRoomStore.roomConnection.peerConnections)[0]?.inboundMediaStream
    : undefined;

  // If not in a conversation or callibration, show start button
  if (!currentContextId || !agentRoomStore.hasCalibrated) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={styles.centerContent}>
          {contextError && (
            <View style={[styles.errorContainer, { backgroundColor: '#FEE2E2' }]}>
              <Text weight="semibold" size={14} style={{ color: '#DC2626' }}>
                {contextError}
              </Text>
            </View>
          )}

          <Button
            title={isCreatingContext ? "Starting..." : (currentContextId && !agentRoomStore.hasCalibrated) ? "Calibrating..." : "Start Conversation"}
            onPress={handleStartConversation}
            style={{ opacity: isCreatingContext || (currentContextId && !agentRoomStore.hasCalibrated) ? 0.5 : 1 }}
          />
        </View>
      </SafeAreaView>
    );
  }

  // In conversation view
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Audio Player (hidden, plays agent audio) */}
      <AudioPlayer stream={inboundAudioStream} />

      {/* Debug Status Messages */}
      {/* <ScrollView 
        style={styles.debugContainer}
        contentContainerStyle={styles.debugContent}
      >
        <DebugStatus
          contextId={currentContextId}
          isConnecting={agentRoomStore.isConnecting}
          isConnected={agentRoomStore.isConnected}
          isCalibrating={agentRoomStore.isCalibrating}
          initializationError={agentRoomStore.initializationError}
          audioMuted={agentRoomStore.audioMuted}
        />
      </ScrollView> */}

      {/* Main Conversation UI */}
      <View style={styles.conversationContainer}>
        {/* AI Messages (Top - Absolutely Positioned) */}
        <AIMessageDisplay
          messages={agentRoomStore.aiMessages}
          currentlySpeakingSentenceId={agentRoomStore.currentlySpeakingSentenceId}
          visible={agentRoomStore.showAIMessages}
        />

        {/* Central Orb - Always centered */}
        <View style={styles.orbContainer}>
          <Orb size={120} />
        </View>

        {/* User Transcription (Below Orb) */}
        <TranscriptionDisplay text={agentRoomStore.currentDetectedSpeech} />
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        {/* <Button
          title={agentRoomStore.audioMuted ? "Unmute Mic" : "Mute Mic"}
          onPress={handleToggleMicrophone}
          style={{ opacity: agentRoomStore.isConnecting ? 0.5 : 1 }}
        />
        <View style={{ height: 12 }} /> */}
        <Button
          title="End Conversation"
          onPress={handleEndConversation}
        />
        {/* <Button
          title="Test Slide-up View"
          onPress={() => {
            agentRoomStore.slideUpViewContentType = 'arl_and_ric';
            agentRoomStore.slideUpViewShouldShow = true;
          }}
        /> */}
      </View>

      {/* Slide-up View for Agent Events */}
      <SlideUpView
        visible={agentRoomStore.slideUpViewShouldShow}
        onDismiss={handleDismissSlideUpView}
      >
        {renderSlideUpContent()}
      </SlideUpView>
    </SafeAreaView>
  );
});

/**
 * DebugStatus - Shows connection status and other debug info
 */
const DebugStatus = observer(({
  contextId,
  isConnecting,
  isConnected,
  isCalibrating,
  initializationError,
  audioMuted
}: {
  contextId: string;
  isConnecting: boolean;
  isConnected: boolean;
  isCalibrating: boolean;
  initializationError?: string;
  audioMuted: boolean;
}) => {
  const { colors } = useTheme();

  const getStatusColor = () => {
    if (initializationError) return '#DC2626'; // Red
    if (isConnected) return '#10B981'; // Green
    if (isConnecting) return '#F59E0B'; // Yellow
    return colors.muted; // Gray
  };

  const getStatusText = () => {
    if (initializationError) return `Error: ${initializationError}`;
    if (isCalibrating) return 'Calibrating...';
    if (isConnected) return 'Connected';
    if (isConnecting) return 'Connecting...';
    return 'Disconnected';
  };

  return (
    <View style={styles.debugBox}>
      <Text weight="semibold" size={12} style={{ color: colors.muted }}>
        Debug Info
      </Text>

      <View style={styles.debugRow}>
        <Text weight="regular" size={11} style={{ color: colors.muted }}>
          Context ID:
        </Text>
        <Text weight="semibold" size={11} style={{ color: colors.text }}>
          {contextId.substring(0, 8)}...
        </Text>
      </View>

      <View style={styles.debugRow}>
        <Text weight="regular" size={11} style={{ color: colors.muted }}>
          Status:
        </Text>
        <Text weight="semibold" size={11} style={{ color: getStatusColor() }}>
          {getStatusText()}
        </Text>
      </View>

      <View style={styles.debugRow}>
        <Text weight="regular" size={11} style={{ color: colors.muted }}>
          Microphone:
        </Text>
        <Text weight="semibold" size={11} style={{ color: audioMuted ? '#DC2626' : '#10B981' }}>
          {audioMuted ? 'Muted' : 'Active'}
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 16,
  },
  title: {
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 24,
  },
  errorContainer: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    width: '100%',
  },
  logoutButton: {
    marginTop: 24,
    padding: 12,
  },
  debugContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    maxHeight: 150,
    zIndex: 10,
  },
  debugContent: {
    padding: 16,
  },
  debugBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  debugRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calibrationOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  calibrationText: {
    color: '#FFFFFF',
    textAlign: 'center',
  },
  conversationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orbContainer: {
    padding: 40,
  },
  controls: {
    padding: 24,
    gap: 8,
  },
});
