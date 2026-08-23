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
}

/**
 * TranscriptionDisplay - Shows the user's final speech transcripts history
 * and auto-scrolls to the latest.
 */
export const TranscriptionDisplay = ({ messages }: TranscriptionDisplayProps) => {
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

    // Auto-scroll to the latest message
    useEffect(() => {
        if (messages.length > 0 && scrollViewRef.current) {
            setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
            }, 100);
        }
    }, [messages.length]);

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
                    return (
                        <View 
                            key={message_id}
                            style={styles.messageContainer}
                        >
                            <Text 
                                size={16} 
                                weight={'regular'}
                                style={styles.text}
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
        flex: 1,
        paddingHorizontal: 24,
        justifyContent: 'flex-start', // Align content to top of container
    },
    scrollView: {
        flexGrow: 0, // Don't grow beyond content
    },
    contentContainer: {
        gap: 12,
        paddingVertical: 16,
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

