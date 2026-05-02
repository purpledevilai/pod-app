import { useTheme } from '@/src/providers/ThemeProvider';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withTiming,
} from 'react-native-reanimated';
import { Text } from '../ui/Text';

interface RewardPanelProps {
    points: number;
    visible: boolean;
}

export const RewardPanel = ({ points, visible }: RewardPanelProps) => {
    const { colors } = useTheme();

    const opacity = useSharedValue(0);
    const scale = useSharedValue(0.7);

    useEffect(() => {
        if (visible) {
            opacity.value = withTiming(1, { duration: 250 });
            scale.value = withSequence(
                withTiming(1.08, { duration: 250 }),
                withTiming(1, { duration: 150 }),
            );
        } else {
            opacity.value = withTiming(0, { duration: 250 });
            scale.value = withTiming(0.7, { duration: 250 });
        }
    }, [visible]);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ scale: scale.value }],
    }));

    if (!visible) {
        return null;
    }

    return (
        <Animated.View style={[styles.container, animatedStyle]}>
            <View style={[styles.card, { backgroundColor: colors.primary }]}>
                <Text
                    weight="semibold"
                    size={48}
                    color={colors.onPrimary}
                    style={styles.points}
                >
                    +{points}
                </Text>
                <Text
                    weight="semibold"
                    size={16}
                    color={colors.onPrimary}
                    style={styles.label}
                >
                    points
                </Text>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    card: {
        paddingVertical: 24,
        paddingHorizontal: 40,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 180,
    },
    points: {
        textAlign: 'center',
    },
    label: {
        textAlign: 'center',
        marginTop: -4,
        opacity: 0.9,
    },
});
