import { Text } from '@/src/components/ui/Text';
import { useEffect, useRef } from 'react';
import { Animated, ScrollView, StyleSheet, View } from 'react-native';

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
 */
export const AIMessageDisplay = ({ 
    messages, 
    currentlySpeakingSentenceId,
    visible 
}: AIMessageDisplayProps) => {
    const scrollViewRef = useRef<ScrollView>(null);
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.timing(opacity, {
                toValue: 1,
                duration: 500,
                useNativeDriver: true,
            }).start();
        } else {
            Animated.timing(opacity, {
                toValue: 0,
                duration: 500,
                useNativeDriver: true,
            }).start();
        }
    }, [visible, opacity]);

    // Auto-scroll to the currently speaking sentence
    useEffect(() => {
        if (currentlySpeakingSentenceId && scrollViewRef.current) {
            // Small delay to ensure the message is rendered
            setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
            }, 100);
        }
    }, [currentlySpeakingSentenceId]);

    if (messages.length === 0) {
        return null;
    }

    return (
        <Animated.View style={[styles.container, { opacity }]}>
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
        maxHeight: 200,
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
    message: {
        textAlign: 'center',
    },
    inactiveMessage: {
        opacity: 0.5,
    },
});

