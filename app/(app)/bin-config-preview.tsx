import { BinClassificationView, POD_BIN_CONFIG, PodBinKey } from '@/src/components/agentroom/BinClassificationView';
import { useTheme } from '@/src/providers/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const POD_BIN_KEYS = Object.keys(POD_BIN_CONFIG) as PodBinKey[];

export default function BinConfigPreviewScreen() {
    const { colors, fonts, space } = useTheme();
    const insets = useSafeAreaInsets();
    const [currentIndex, setCurrentIndex] = useState(0);

    const currentKey = POD_BIN_KEYS[currentIndex];
    const config = POD_BIN_CONFIG[currentKey];

    const goBack = () => {
        setCurrentIndex((prev) => (prev - 1 + POD_BIN_KEYS.length) % POD_BIN_KEYS.length);
    };

    const goForward = () => {
        setCurrentIndex((prev) => (prev + 1) % POD_BIN_KEYS.length);
    };

    return (
        <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
            {/* Header */}
            <View style={[styles.header, { paddingHorizontal: space.lg }]}>
                <Pressable onPress={() => router.back()} hitSlop={12}>
                    <Ionicons name="chevron-back" size={28} color={colors.text} />
                </Pressable>
                <Text style={[styles.headerTitle, { color: colors.text, fontFamily: fonts.semibold }]}>
                    Bin Config Preview
                </Text>
                <View style={{ width: 28 }} />
            </View>

            {/* Config key label */}
            <View style={styles.labelContainer}>
                <Text style={[styles.keyLabel, { color: colors.text, fontFamily: fonts.semibold }]}>
                    {currentKey}
                </Text>
                <Text style={[styles.coordLabel, { color: colors.muted, fontFamily: fonts.regular }]}>
                    arrow: ({config.arrowPosition.x.toFixed(2)}, {config.arrowPosition.y.toFixed(2)})
                </Text>
                <Text style={[styles.indexLabel, { color: colors.muted, fontFamily: fonts.regular }]}>
                    {currentIndex + 1} / {POD_BIN_KEYS.length}
                </Text>
            </View>

            {/* Preview */}
            <View style={styles.previewContainer}>
                <BinClassificationView
                    color=""
                    binType="pod"
                    podConfiguration="freestanding"
                    visible={true}
                    previewConfigKey={currentKey}
                />
            </View>

            {/* Navigation buttons */}
            <View style={[styles.navRow, { paddingBottom: insets.bottom + space.lg }]}>
                <Pressable
                    onPress={goBack}
                    style={[styles.navButton, { backgroundColor: colors.primary }]}
                >
                    <Ionicons name="chevron-back" size={24} color={colors.onPrimary} />
                    <Text style={[styles.navButtonText, { color: colors.onPrimary, fontFamily: fonts.semibold }]}>
                        Previous
                    </Text>
                </Pressable>

                <Pressable
                    onPress={goForward}
                    style={[styles.navButton, { backgroundColor: colors.primary }]}
                >
                    <Text style={[styles.navButtonText, { color: colors.onPrimary, fontFamily: fonts.semibold }]}>
                        Next
                    </Text>
                    <Ionicons name="chevron-forward" size={24} color={colors.onPrimary} />
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
    },
    headerTitle: {
        fontSize: 18,
    },
    labelContainer: {
        alignItems: 'center',
        paddingVertical: 16,
    },
    keyLabel: {
        fontSize: 20,
    },
    coordLabel: {
        fontSize: 14,
        marginTop: 4,
    },
    indexLabel: {
        fontSize: 13,
        marginTop: 2,
    },
    previewContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    navRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        gap: 16,
    },
    navButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 14,
        gap: 6,
    },
    navButtonText: {
        fontSize: 16,
    },
});
