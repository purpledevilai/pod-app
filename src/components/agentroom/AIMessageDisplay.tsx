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
    sentence: string;
    sentence_id: string;
}

interface AIMessageDisplayProps {
    messages: AIMessage[];
    currentlySpeakingSentenceId: string | undefined;
    visible: boolean;
}

/**
 * AIMessageDisplay - Shows AI messages below the orb
 * Highlights the currently speaking sentence in bold
 * Auto-scrolls to active message
 * Smoothly animates in/out to prevent UI jumps
 */
export const AIMessageDisplay = ({ 
    messages, 
    currentlySpeakingSentenceId,
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

    // Auto-scroll to the currently speaking sentence
    useEffect(() => {
        if (currentlySpeakingSentenceId && scrollViewRef.current) {
            // Small delay to ensure the message is rendered
            setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
            }, 100);
        }
    }, [currentlySpeakingSentenceId]);

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
                {messages.map(({ sentence, sentence_id }) => {
                    const isSpeaking = currentlySpeakingSentenceId === sentence_id;
                    return (
                        <View 
                            key={sentence_id}
                            style={styles.messageContainer}
                        >
                            <Text
                                size={16}
                                weight={isSpeaking ? 'semibold' : 'regular'}
                                style={[
                                    styles.message,
                                    !isSpeaking && styles.inactiveMessage
                                ]}
                            >
                                {sentence}
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
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        maxHeight: 200,
        paddingHorizontal: 24,
        paddingVertical: 16,
        zIndex: 10,
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
    message: {
        textAlign: 'center',
    },
    inactiveMessage: {
        opacity: 0.5,
    },
});

