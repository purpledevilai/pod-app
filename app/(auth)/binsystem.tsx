import { Button } from '@/src/components/ui/Button';
import { Text } from '@/src/components/ui/Text';
import { useContent } from '@/src/providers/ContentProvider';
import { useStores } from '@/src/providers/StoreProvider';
import { useTheme } from '@/src/providers/ThemeProvider';
import { BinSystem } from '@/src/services/api/types/binsystem';
import { useHeaderHeight } from '@react-navigation/elements';
import { observer } from 'mobx-react-lite';
import {
    Image,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    View
} from 'react-native';

// Bin appearance to image mapping
const BIN_IMAGES = {
    'Green': require('@/assets/images/bins/bin-darkgreen.png'),
    'Lime Green': require('@/assets/images/bins/bin-lightgreen.png'),
    'Blue': require('@/assets/images/bins/bin-blue.png'),
    'Red': require('@/assets/images/bins/bin-red.png'),
    'Yellow': require('@/assets/images/bins/bin-yellow.png'),
    'Purple': require('@/assets/images/bins/bin-purple.png'),
    'Maroon': require('@/assets/images/bins/bin-maroon.png'),
    'No Bin System': require('@/assets/images/bins/no-bins-ic.svg'),
} as const;

export default observer(function BinSystemScreen() {
    const { space, colors } = useTheme();
    const { copy } = useContent();
    const acStore = useStores().accountCreationStore;
    const headerHeight = useHeaderHeight();

    function onSelectBinSystem(binSystem: BinSystem) {
        acStore.setBinSystem(binSystem);
    }

    async function onSubmit() {
        if (!acStore.selectedBinSystem || acStore.binSystemLookUpLoading) return;
        console.log("Submitting bin system", acStore.selectedBinSystem.id);
        try {
            
            // Add any bin system selection logic here
            //router.push('/(auth)/next-step'); // Navigate to next step
        } catch (error) {
            console.log("Error submitting bin system:", error);
        } 
    }

    function renderBinSystemOption(binSystem: BinSystem, isSelected: boolean) {
        return (
            <Pressable
                key={binSystem.id}
                style={[
                    styles.binSystemItem,
                    {
                        borderColor: isSelected ? colors.primary : colors.muted,
                        backgroundColor: isSelected ? colors.muted : colors.bg,
                    }
                ]}
                onPress={() => onSelectBinSystem(binSystem)}
            >
                <View style={styles.binsContainer}>
                    {binSystem.bins.map((bin, index) => (
                        <View key={bin.id} style={styles.binItem}>
                            <Image
                                source={BIN_IMAGES[bin.appearance as keyof typeof BIN_IMAGES] || BIN_IMAGES['No Bin System']}
                                style={styles.binImage}
                                resizeMode="contain"
                            />
                            <Text
                                size={12}
                                style={[styles.binLabel, { color: colors.muted }]}
                                numberOfLines={2}
                            >
                                {bin.type}
                            </Text>
                        </View>
                    ))}
                </View>
            </Pressable>
        );
    }

    return (
        <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.select({ ios: 'padding', android: undefined })}
            keyboardVerticalOffset={headerHeight}
        >
            <View style={styles.container}>
                <ScrollView
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={[
                        styles.scrollContent,
                        {
                            paddingTop: space.lg,
                            paddingHorizontal: space.lg,
                            paddingBottom: space.xl,
                        },
                    ]}
                >
                    <Text weight="semibold" size={40} style={styles.title}>
                        {copy.screens.binSystem.title}
                    </Text>

                    <View style={styles.binSystemList}>
                        {acStore.binSystems.map((binSystem) =>
                            renderBinSystemOption(
                                binSystem,
                                acStore.selectedBinSystem?.id === binSystem.id
                            )
                        )}
                    </View>
                </ScrollView>

                <View style={[styles.ctaWrap, { paddingHorizontal: space.lg, paddingBottom: space.lg }]}>
                    <Button
                        title={acStore.binSystemLookUpLoading ? copy.screens.binSystem.ctaSubmitting : copy.screens.binSystem.ctaContinue}
                        onPress={onSubmit}
                        style={{ opacity: acStore.selectedBinSystem && !acStore.binSystemLookUpLoading ? 1 : 0.5 }}
                    />
                </View>
            </View>
        </KeyboardAvoidingView>
    );
})

const styles = StyleSheet.create({
    flex: { flex: 1 },
    container: { flex: 1 },
    scrollContent: { flexGrow: 1 },
    title: { marginBottom: 32, lineHeight: 48 },
    binSystemList: { gap: 16 },
    binSystemItem: {
        padding: 20,
        borderRadius: 12,
        borderWidth: 2,
    },
    binsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
        justifyContent: 'center',
    },
    binItem: {
        alignItems: 'center',
        minWidth: 60,
    },
    binImage: {
        width: 48,
        height: 64,
        marginBottom: 8,
    },
    binLabel: {
        textAlign: 'center',
        lineHeight: 16,
    },
    ctaWrap: {},
});