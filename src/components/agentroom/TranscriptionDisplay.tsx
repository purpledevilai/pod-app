import { Text } from '@/src/components/ui/Text';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming
} from 'react-native-reanimated';

interface TranscriptionDisplayProps {
    text: string | undefined;
}

/**
 * TranscriptionDisplay - Shows the user's detected speech
 * Slides up from below with smooth fade-in animation
 */
export const TranscriptionDisplay = ({ text }: TranscriptionDisplayProps) => {
    // Shared values for animations
    const opacity = useSharedValue(0);
    const translateY = useSharedValue(20);
    const scale = useSharedValue(0.95);

    useEffect(() => {
        if (text) {
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
    }, [text]);

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

    return (
        <Animated.View style={[styles.container, animatedStyle]}>
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

