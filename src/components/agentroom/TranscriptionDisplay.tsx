import { Text } from '@/src/components/ui/Text';
import { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming
} from 'react-native-reanimated';

interface UserMessage {
    text: string;
    message_id: string;
}

interface TranscriptionDisplayProps {
    messages: UserMessage[];
    currentMessageId: string | undefined;
}

/**
 * TranscriptionDisplay - Shows the user's detected speech history
 * Highlights the currently active message and auto-scrolls to it
 */
export const TranscriptionDisplay = ({ messages, currentMessageId }: TranscriptionDisplayProps) => {
    const scrollViewRef = useRef<ScrollView>(null);
    
    // Shared values for animations
    const opacity = useSharedValue(0);
    const translateY = useSharedValue(20);
    const scale = useSharedValue(0.95);

    const hasMessages = messages.length > 0 && messages.some(m => m.text.length > 0);

    useEffect(() => {
        if (hasMessages) {
            // Slide up and fade in
            opacity.value = withTiming(1, {
                duration: 400,
                easing: Easing.out(Easing.cubic)
            });
            translateY.value = withSpring(0, {
                damping: 15,
                stiffness: 150
            });
            scale.value = withSpring(1, {
                damping: 15,
                stiffness: 150
            });
        } else {
            // Slide down and fade out
            opacity.value = withTiming(0, {
                duration: 300,
                easing: Easing.in(Easing.cubic)
            });
            translateY.value = withTiming(20, {
                duration: 300,
                easing: Easing.in(Easing.cubic)
            });
            scale.value = withTiming(0.95, {
                duration: 300,
                easing: Easing.in(Easing.cubic)
            });
        }
    }, [hasMessages]);

    // Auto-scroll to the current active message
    useEffect(() => {
        if (currentMessageId && scrollViewRef.current) {
            setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
            }, 100);
        }
    }, [currentMessageId, messages]);

    // Animated style combining opacity, translation, and scale
    const animatedStyle = useAnimatedStyle(() => {
        return {
            opacity: opacity.value,
            transform: [
                { translateY: translateY.value },
                { scale: scale.value }
            ],
        };
    });

    // Filter out empty messages
    const visibleMessages = messages.filter(m => m.text.length > 0);

    if (visibleMessages.length === 0) {
        return null;
    }

    return (
        <Animated.View style={[styles.container, animatedStyle]}>
            <ScrollView
                ref={scrollViewRef}
                style={styles.scrollView}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
            >
                {visibleMessages.map(({ text, message_id }) => {
                    const isActive = currentMessageId === message_id;
                    return (
                        <View 
                            key={message_id}
                            style={styles.messageContainer}
                        >
                            <Text 
                                size={16} 
                                weight={isActive ? 'semibold' : 'regular'}
                                style={[
                                    styles.text,
                                    !isActive && styles.inactiveMessage
                                ]}
                            >
                                {text}
                            </Text>
                        </View>
                    );
                })}
            </ScrollView>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        maxHeight: 150,
        paddingHorizontal: 24,
        paddingVertical: 16,
    },
    scrollView: {
        flex: 1,
    },
    contentContainer: {
        gap: 12,
    },
    messageContainer: {
        alignItems: 'center',
    },
    text: {
        textAlign: 'center',
    },
    inactiveMessage: {
        opacity: 0.5,
    },
});

