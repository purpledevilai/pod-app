import { Text } from '@/src/components/ui/Text';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

interface TranscriptionDisplayProps {
    text: string | undefined;
}

/**
 * TranscriptionDisplay - Shows the user's detected speech
 * Appears above the orb with fade-in animation
 */
export const TranscriptionDisplay = ({ text }: TranscriptionDisplayProps) => {
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (text) {
            // Fade in
            Animated.timing(opacity, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }).start();
        } else {
            // Fade out
            Animated.timing(opacity, {
                toValue: 0,
                duration: 500,
                useNativeDriver: true,
            }).start();
        }
    }, [text, opacity]);

    return (
        <Animated.View style={[styles.container, { opacity }]}>
            <Text 
                size={16} 
                weight="regular"
                style={styles.text}
                numberOfLines={3}
            >
                {text || ' '}
            </Text>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 24,
        paddingVertical: 16,
        minHeight: 60,
        justifyContent: 'flex-end',
        alignItems: 'center',
    },
    text: {
        textAlign: 'center',
    },
});

