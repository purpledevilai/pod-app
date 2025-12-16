import { Text } from '@/src/components/ui/Text';
import { useTheme } from '@/src/providers/ThemeProvider';
import { useEffect, useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const VIEW_HEIGHT_PERCENTAGE = 0.75;
const VIEW_HEIGHT = SCREEN_HEIGHT * VIEW_HEIGHT_PERCENTAGE;
const DISMISS_THRESHOLD = VIEW_HEIGHT * 0.3; // 30% drag threshold
const ANIMATION_DURATION = 300;

interface SlideUpViewProps {
    visible: boolean;
    onDismiss: () => void;
    children?: React.ReactNode;
}

/**
 * SlideUpView - Modal view that slides up from the bottom
 * Can be dismissed by tapping outside or dragging down
 */
export const SlideUpView = ({ visible, onDismiss, children }: SlideUpViewProps) => {
    const { colors } = useTheme();
    const translateY = useSharedValue(VIEW_HEIGHT);
    const backdropOpacity = useSharedValue(0);
    const [isMounted, setIsMounted] = useState(false);

    // Handle animation completion callback
    const handleAnimationComplete = () => {
        setIsMounted(false);
    };

    // Animate in/out when visible changes
    useEffect(() => {
        if (visible) {
            // Mount and slide up
            setIsMounted(true);
            translateY.value = withSpring(0, {
                damping: 20,
                stiffness: 90,
            });
            backdropOpacity.value = withTiming(1, { duration: ANIMATION_DURATION });
        } else if (isMounted) {
            // Slide down, then unmount after animation completes
            translateY.value = withTiming(VIEW_HEIGHT, { duration: ANIMATION_DURATION });
            backdropOpacity.value = withTiming(0, { duration: ANIMATION_DURATION }, () => {
                runOnJS(handleAnimationComplete)();
            });
        }
    }, [visible]);

    // Pan gesture for dragging down
    const panGesture = Gesture.Pan()
        .onChange((event) => {
            // Only allow dragging down
            if (event.translationY > 0) {
                translateY.value = event.translationY;
            }
        })
        .onEnd((event) => {
            // If dragged past threshold or velocity is high, dismiss
            if (event.translationY > DISMISS_THRESHOLD || event.velocityY > 500) {
                translateY.value = withTiming(VIEW_HEIGHT, { duration: ANIMATION_DURATION });
                backdropOpacity.value = withTiming(0, { duration: ANIMATION_DURATION }, () => {
                    runOnJS(handleAnimationComplete)();
                });
                runOnJS(onDismiss)();
            } else {
                // Otherwise, snap back
                translateY.value = withSpring(0, {
                    damping: 20,
                    stiffness: 90,
                });
            }
        });

    const animatedViewStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    const animatedBackdropStyle = useAnimatedStyle(() => ({
        opacity: backdropOpacity.value,
    }));

    // Don't render until we need to show (or are animating out)
    if (!isMounted && !visible) {
        return null;
    }

    return (
        <Modal
            transparent
            visible={isMounted}
            statusBarTranslucent
            animationType="none"
            onRequestClose={onDismiss}
        >
            <GestureHandlerRootView style={{ flex: 1 }}>
                <View style={styles.container}>
                    {/* Backdrop - tap to dismiss */}
                    <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss}>
                        <Animated.View
                            style={[
                                StyleSheet.absoluteFill,
                                styles.backdrop,
                                animatedBackdropStyle,
                            ]}
                        />
                    </Pressable>

                    {/* Slide-up content */}
                    <GestureDetector gesture={panGesture}>
                        <Animated.View
                            style={[
                                styles.slideUpContent,
                                { backgroundColor: colors.bg },
                                animatedViewStyle,
                            ]}
                        >
                            {/* Drag handle */}
                            <View style={styles.handleContainer}>
                                <View style={[styles.handle, { backgroundColor: colors.muted }]} />
                            </View>

                            {/* Content */}
                            <View style={styles.contentContainer}>
                                {children || <PlaceholderContent />}
                            </View>
                        </Animated.View>
                    </GestureDetector>
                </View>
            </GestureHandlerRootView>
        </Modal>
    );
};

/**
 * Placeholder content shown when no children provided
 */
const PlaceholderContent = () => {
    const { colors } = useTheme();
    
    return (
        <View style={styles.placeholderContainer}>
            <Text weight="semibold" size={18} style={{ color: colors.text }}>
                Slide-up View
            </Text>
            <Text weight="regular" size={14} style={{ color: colors.muted, marginTop: 8 }}>
                Content will appear here based on agent events
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    slideUpContent: {
        height: VIEW_HEIGHT,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: -4,
        },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 10,
    },
    handleContainer: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        opacity: 0.3,
    },
    contentContainer: {
        flex: 1,
        paddingHorizontal: 24,
        paddingBottom: 24,
    },
    placeholderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

