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

const KERBSIDE_BIN_IMAGE_MAP: Record<string, ImageSourcePropType> = {
    'yellow': require('@/assets/images/bins/bin-yellow.png'),
    'red': require('@/assets/images/bins/bin-red.png'),
    'blue': require('@/assets/images/bins/bin-blue.png'),
    'green': require('@/assets/images/bins/bin-darkgreen.png'),
    'lime green': require('@/assets/images/bins/bin-lightgreen.png'),
    'purple': require('@/assets/images/bins/bin-purple.png'),
    'maroon': require('@/assets/images/bins/bin-maroon.png'),
};

const POD_BIN_IMAGES = {
    drawer: require('@/assets/images/pod_bins/drawer.png'),
    undersink: require('@/assets/images/pod_bins/undersink.png'),
    freestanding_top: require('@/assets/images/pod_bins/freestanding_top_open.png'),
    freestanding_bottom: require('@/assets/images/pod_bins/freestanding_bottom_open.png'),
};

export type PodBinKey =
    | 'drawer-red' | 'drawer-yellow' | 'drawer-green' | 'drawer-white'
    | 'undersink-red' | 'undersink-yellow' | 'undersink-green' | 'undersink-white'
    | 'freestanding-top-red' | 'freestanding-top-green'
    | 'freestanding-bottom-yellow' | 'freestanding-bottom-white';

interface PodBinConfig {
    image: ImageSourcePropType;
    arrowPosition: { x: number; y: number };
}

export const POD_BIN_CONFIG: Record<PodBinKey, PodBinConfig> = {
    'drawer-red':               { image: POD_BIN_IMAGES.drawer, arrowPosition: { x: 0.4, y: 0.42 } },
    'drawer-yellow':            { image: POD_BIN_IMAGES.drawer, arrowPosition: { x: 0.55, y: 0.4 } },
    'drawer-green':             { image: POD_BIN_IMAGES.drawer, arrowPosition: { x: 0.46, y: 0.46 } },
    'drawer-white':             { image: POD_BIN_IMAGES.drawer, arrowPosition: { x: 0.63, y: 0.35 } },
    'undersink-red':            { image: POD_BIN_IMAGES.undersink, arrowPosition: { x: 0.33, y: 0.51 } },
    'undersink-yellow':         { image: POD_BIN_IMAGES.undersink, arrowPosition: { x: 0.5, y: 0.5 } },
    'undersink-green':          { image: POD_BIN_IMAGES.undersink, arrowPosition: { x: 0.44, y: 0.53 } },
    'undersink-white':          { image: POD_BIN_IMAGES.undersink, arrowPosition: { x: 0.49, y: 0.43 } },
    'freestanding-top-red':     { image: POD_BIN_IMAGES.freestanding_top, arrowPosition: { x: 0.47, y: 0.4 } },
    'freestanding-top-green':   { image: POD_BIN_IMAGES.freestanding_top, arrowPosition: { x: 0.4, y: 0.35 } },
    'freestanding-bottom-yellow': { image: POD_BIN_IMAGES.freestanding_bottom, arrowPosition: { x: 0.38, y: 0.56 } },
    'freestanding-bottom-white':  { image: POD_BIN_IMAGES.freestanding_bottom, arrowPosition: { x: 0.34, y: 0.49 } },
};

function getPodBinKey(podConfiguration: PodConfiguration, color: string): PodBinKey | undefined {
    if (podConfiguration === 'in_drawer') {
        const key = `drawer-${color}` as PodBinKey;
        return key in POD_BIN_CONFIG ? key : undefined;
    }
    if (podConfiguration === 'under_sink') {
        const key = `undersink-${color}` as PodBinKey;
        return key in POD_BIN_CONFIG ? key : undefined;
    }
    if (podConfiguration === 'freestanding') {
        if (color === 'yellow' || color === 'white') {
            const key = `freestanding-bottom-${color}` as PodBinKey;
            return key in POD_BIN_CONFIG ? key : undefined;
        }
        const key = `freestanding-top-${color}` as PodBinKey;
        return key in POD_BIN_CONFIG ? key : undefined;
    }
    return undefined;
}

const POD_IMAGE_SIZE = 480;

interface BinClassificationViewProps {
    color: string;
    binType?: "kerbside" | "pod";
    podConfiguration?: PodConfiguration;
    visible: boolean;
    /** When set, bypasses normal podConfiguration/color logic and directly uses this config key */
    previewConfigKey?: PodBinKey;
}

export const BinClassificationView = ({ color, binType, podConfiguration, visible, previewConfigKey }: BinClassificationViewProps) => {
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

    const isPod = binType === 'pod' || !!previewConfigKey;
    const podBinKey = previewConfigKey
        ?? (isPod && podConfiguration && podConfiguration !== 'none'
            ? getPodBinKey(podConfiguration, color)
            : undefined);
    const podBinConfig = podBinKey ? POD_BIN_CONFIG[podBinKey] : undefined;

    const kerbsideBinSource = !isPod
        ? (KERBSIDE_BIN_IMAGE_MAP[color] || require('@/assets/images/bins/no-bins-ic.png'))
        : null;

    return (
        <Animated.View style={[styles.container, animatedContainerStyle]}>
            {isPod && podBinConfig ? (
                <View style={styles.podContainer}>
                    <View style={{ width: POD_IMAGE_SIZE, height: POD_IMAGE_SIZE }}>
                        <Image
                            source={podBinConfig.image}
                            style={styles.podImage}
                            resizeMode="contain"
                        />
                        <Animated.View
                            style={[
                                styles.podArrowContainer,
                                animatedArrowStyle,
                                {
                                    left: podBinConfig.arrowPosition.x * POD_IMAGE_SIZE - 10,
                                    top: podBinConfig.arrowPosition.y * POD_IMAGE_SIZE - 57,
                                },
                            ]}
                        >
                            <View style={styles.arrow}>
                                <View style={styles.arrowLine} />
                                <View style={styles.arrowHead} />
                            </View>
                        </Animated.View>
                    </View>
                </View>
            ) : kerbsideBinSource ? (
                <>
                    <Animated.View style={[styles.arrowContainer, animatedArrowStyle]}>
                        <View style={styles.arrow}>
                            <View style={styles.arrowLine} />
                            <View style={styles.arrowHead} />
                        </View>
                    </Animated.View>
                    <View style={styles.binContainer}>
                        <Image
                            source={kerbsideBinSource}
                            style={styles.binImage}
                            resizeMode="contain"
                        />
                    </View>
                </>
            ) : null}
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
        width: POD_IMAGE_SIZE,
        height: POD_IMAGE_SIZE,
    },
    podArrowContainer: {
        position: 'absolute',
    },
    binContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    binImage: {
        width: 240,
        height: 240,
    },
});
