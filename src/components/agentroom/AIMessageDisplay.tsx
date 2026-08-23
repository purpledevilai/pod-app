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

interface AIMessage {
    text: string;
    message_id: string;
}

interface AIMessageDisplayProps {
    messages: AIMessage[];
    visible: boolean;
}

/**
 * AIMessageDisplay - Shows the agent's final transcripts below the orb.
 * Auto-scrolls to the latest message and animates in/out to prevent UI jumps.
 */
export const AIMessageDisplay = ({ 
    messages, 
    visible 
}: AIMessageDisplayProps) => {
    const scrollViewRef = useRef<ScrollView>(null);
    
    // Shared values for animations
    const opacity = useSharedValue(0);
    const translateY = useSharedValue(-20);
    const scale = useSharedValue(0.95);

    useEffect(() => {
        if (visible) {
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
            opacity.value = withTiming(0, { 
                duration: 300,
                easing: Easing.in(Easing.cubic)
            });
            translateY.value = withTiming(-20, { 
                duration: 300,
                easing: Easing.in(Easing.cubic)
            });
            scale.value = withTiming(0.95, { 
                duration: 300,
                easing: Easing.in(Easing.cubic)
            });
        }
    }, [visible]);

    // Auto-scroll to the latest message
    useEffect(() => {
        if (messages.length > 0 && scrollViewRef.current) {
            // Small delay to ensure the message is rendered
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

    if (messages.length === 0) {
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
                {messages.map(({ text, message_id }) => {
                    return (
                        <View 
                            key={message_id}
                            style={styles.messageContainer}
                        >
                            <Text
                                size={16}
                                weight={'regular'}
                                style={styles.message}
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
        justifyContent: 'flex-end', // Align content to bottom of container
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
    message: {
        textAlign: 'center',
    },
    inactiveMessage: {
        opacity: 0.5,
    },
});

