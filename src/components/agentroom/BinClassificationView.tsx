import { useEffect } from 'react';
import { Image, ImageSourcePropType, StyleSheet, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';
import { PodConfiguration } from '@/src/services/api/types/user';

const BIN_IMAGE_MAP: Record<string, ImageSourcePropType> = {
    'bin-yellow.png': require('@/assets/images/bins/bin-yellow.png'),
    'bin-red.png': require('@/assets/images/bins/bin-red.png'),
    'bin-blue.png': require('@/assets/images/bins/bin-blue.png'),
    'bin-darkgreen.png': require('@/assets/images/bins/bin-darkgreen.png'),
    'bin-lightgreen.png': require('@/assets/images/bins/bin-lightgreen.png'),
    'bin-purple.png': require('@/assets/images/bins/bin-purple.png'),
    'bin-maroon.png': require('@/assets/images/bins/bin-maroon.png'),
};

const POD_CONFIG_IMAGES: Partial<Record<PodConfiguration, ImageSourcePropType>> = {
    freestanding: require('@/assets/images/pod_bins/freestanding_top_open.png'),
    in_drawer: require('@/assets/images/pod_bins/drawer.png'),
    under_sink: require('@/assets/images/pod_bins/undersink.png'),
};

interface BinClassificationViewProps {
    binImage: string;
    podConfiguration?: PodConfiguration;
    visible: boolean;
}

export const BinClassificationView = ({ binImage, podConfiguration, visible }: BinClassificationViewProps) => {
    const opacity = useSharedValue(0);
    const scale = useSharedValue(0.8);
    const arrowTranslateY = useSharedValue(0);

    useEffect(() => {
        if (visible) {
            opacity.value = withTiming(1, { duration: 400 });
            scale.value = withTiming(1, { duration: 400 });
            arrowTranslateY.value = withRepeat(
                withSequence(
                    withTiming(-15, { duration: 800 }),
                    withTiming(0, { duration: 800 })
                ),
                -1,
                false
            );
        } else {
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

    const podImage = podConfiguration && podConfiguration !== 'none'
        ? POD_CONFIG_IMAGES[podConfiguration]
        : null;

    const binSource = BIN_IMAGE_MAP[binImage] || require('@/assets/images/bins/no-bins-ic.png');

    return (
        <Animated.View style={[styles.container, animatedContainerStyle]}>
            {podImage ? (
                // Show pod configuration image when user has a Pod
                <View style={styles.podContainer}>
                    <Image
                        source={podImage}
                        style={styles.podImage}
                        resizeMode="contain"
                    />
                </View>
            ) : (
                // Fallback: show individual bin with floating arrow
                <>
                    <Animated.View style={[styles.arrowContainer, animatedArrowStyle]}>
                        <View style={styles.arrow}>
                            <View style={styles.arrowLine} />
                            <View style={styles.arrowHead} />
                        </View>
                    </Animated.View>
                    <View style={styles.binContainer}>
                        <Image
                            source={binSource}
                            style={styles.binImage}
                            resizeMode="contain"
                        />
                    </View>
                </>
            )}
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
    podContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    podImage: {
        width: 240,
        height: 240,
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

