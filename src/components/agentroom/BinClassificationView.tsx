import { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';

interface BinClassificationViewProps {
    binImage: string;
    visible: boolean;
}

/**
 * BinClassificationView - Shows the classified bin with a floating arrow
 * Replaces the orb during bin classification
 */
export const BinClassificationView = ({ binImage, visible }: BinClassificationViewProps) => {
    const opacity = useSharedValue(0);
    const scale = useSharedValue(0.8);
    const arrowTranslateY = useSharedValue(0);

    // Animate in/out when visible changes
    useEffect(() => {
        if (visible) {
            // Fade in and scale up
            opacity.value = withTiming(1, { duration: 400 });
            scale.value = withTiming(1, { duration: 400 });
            
            // Start arrow floating animation
            arrowTranslateY.value = withRepeat(
                withSequence(
                    withTiming(-15, { duration: 800 }),
                    withTiming(0, { duration: 800 })
                ),
                -1, // Repeat infinitely
                false
            );
        } else {
            // Fade out and scale down
            opacity.value = withTiming(0, { duration: 300 });
            scale.value = withTiming(0.8, { duration: 300 });
            arrowTranslateY.value = 0;
        }
    }, [visible]);

    const animatedContainerStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ scale: scale.value }],
    }));

    const animatedArrowStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: arrowTranslateY.value }],
    }));

    if (!visible) {
        return null;
    }

    return (
        <Animated.View style={[styles.container, animatedContainerStyle]}>
            {/* Floating Arrow */}
            <Animated.View style={[styles.arrowContainer, animatedArrowStyle]}>
                <View style={styles.arrow}>
                    <View style={styles.arrowLine} />
                    <View style={styles.arrowHead} />
                </View>
            </Animated.View>

            {/* Bin Image */}
            <View style={styles.binContainer}>
                <Image
                    source={
                        binImage === 'bin-yellow.png' ? require('@/assets/images/bins/bin-yellow.png') :
                        binImage === 'bin-red.png' ? require('@/assets/images/bins/bin-red.png') :
                        binImage === 'bin-blue.png' ? require('@/assets/images/bins/bin-blue.png') :
                        binImage === 'bin-darkgreen.png' ? require('@/assets/images/bins/bin-darkgreen.png') :
                        binImage === 'bin-lightgreen.png' ? require('@/assets/images/bins/bin-lightgreen.png') :
                        binImage === 'bin-purple.png' ? require('@/assets/images/bins/bin-purple.png') :
                        binImage === 'bin-maroon.png' ? require('@/assets/images/bins/bin-maroon.png') :
                        require('@/assets/images/bins/no-bins-ic.png')
                    }
                    style={styles.binImage}
                    resizeMode="contain"
                />
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    arrowContainer: {
        marginBottom: 20,
    },
    arrow: {
        alignItems: 'center',
    },
    arrowLine: {
        width: 3,
        height: 40,
        backgroundColor: '#000',
        borderRadius: 2,
    },
    arrowHead: {
        width: 0,
        height: 0,
        backgroundColor: 'transparent',
        borderStyle: 'solid',
        borderLeftWidth: 10,
        borderRightWidth: 10,
        borderTopWidth: 15,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: '#000',
        marginTop: -2,
    },
    binContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    binImage: {
        width: 180,
        height: 180,
    },
});

