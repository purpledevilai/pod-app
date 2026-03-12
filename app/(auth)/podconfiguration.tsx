import { Button } from '@/src/components/ui/Button';
import { Text } from '@/src/components/ui/Text';
import { useContent } from '@/src/providers/ContentProvider';
import { useStores } from '@/src/providers/StoreProvider';
import { useTheme } from '@/src/providers/ThemeProvider';
import { PodConfiguration } from '@/src/services/api/types/user';
import { useHeaderHeight } from '@react-navigation/elements';
import { router } from 'expo-router';
import { observer } from 'mobx-react-lite';
import {
    Image,
    ImageSourcePropType,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    View
} from 'react-native';

const POD_OPTIONS: { key: PodConfiguration; label: string; image: ImageSourcePropType }[] = [
    {
        key: 'freestanding',
        label: 'Freestanding',
        image: require('@/assets/images/pod_bins/freestanding_top_open.png'),
    },
    {
        key: 'in_drawer',
        label: 'In Drawer',
        image: require('@/assets/images/pod_bins/drawer.png'),
    },
    {
        key: 'under_sink',
        label: 'Under Sink',
        image: require('@/assets/images/pod_bins/undersink.png'),
    },
];

export default observer(function PodConfigurationScreen() {
    const { space, colors } = useTheme();
    const { copy } = useContent();
    const { accountCreationStore: acStore, authStore } = useStores();
    const headerHeight = useHeaderHeight();

    function onSelect(config: PodConfiguration) {
        acStore.setPodConfiguration(config);
    }

    async function onSubmit() {
        if (acStore.createAccountLoading) return;
        try {
            const response = await acStore.createAccount();
            await authStore.loginWithTokens(response.access_token, response.refresh_token);
            await authStore.fetchUser();
            router.push('/(app)/landing');
        } catch (error) {
            console.log("Error creating account:", error);
        }
    }

    async function onSkip() {
        acStore.setPodConfiguration('none');
        await onSubmit();
    }

    const selected = acStore.selectedPodConfiguration;
    const hasSelection = selected !== 'none';

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
                        {copy.screens.podConfiguration.title}
                    </Text>

                    <Text size={16} style={[styles.subtitle, { color: colors.muted }]}>
                        {copy.screens.podConfiguration.subtitle}
                    </Text>

                    <View style={styles.optionsList}>
                        {POD_OPTIONS.map((option) => {
                            const isSelected = selected === option.key;
                            return (
                                <Pressable
                                    key={option.key}
                                    style={[
                                        styles.optionItem,
                                        {
                                            borderColor: isSelected ? colors.primary : colors.muted,
                                            borderWidth: isSelected ? 2 : 1,
                                            backgroundColor: colors.bg,
                                        }
                                    ]}
                                    onPress={() => onSelect(option.key)}
                                >
                                    <Image
                                        source={option.image}
                                        style={styles.optionImage}
                                        resizeMode="contain"
                                    />
                                    <Text
                                        weight="semibold"
                                        size={16}
                                        style={[styles.optionLabel, { color: colors.text }]}
                                    >
                                        {option.label}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                </ScrollView>

                <View style={[styles.ctaWrap, { paddingHorizontal: space.lg, paddingBottom: space.lg }]}>
                    <Button
                        title={acStore.createAccountLoading
                            ? copy.screens.podConfiguration.ctaSubmitting
                            : hasSelection
                                ? copy.screens.podConfiguration.ctaContinue
                                : copy.screens.podConfiguration.ctaSkip
                        }
                        onPress={hasSelection ? onSubmit : onSkip}
                        style={{ opacity: acStore.createAccountLoading ? 0.5 : 1 }}
                    />
                    {acStore.createAccountError && (
                        <Text size={14} style={{ color: '#FF0000', textAlign: 'center', marginTop: space.sm }}>
                            {acStore.createAccountError}
                        </Text>
                    )}
                </View>
            </View>
        </KeyboardAvoidingView>
    );
});

const styles = StyleSheet.create({
    flex: { flex: 1 },
    container: { flex: 1 },
    scrollContent: { flexGrow: 1 },
    title: { marginBottom: 8, lineHeight: 48 },
    subtitle: { marginBottom: 32, lineHeight: 22 },
    optionsList: { gap: 16 },
    optionItem: {
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    optionImage: {
        width: '100%',
        height: 180,
        marginBottom: 12,
    },
    optionLabel: {
        textAlign: 'center',
    },
    ctaWrap: {},
});
