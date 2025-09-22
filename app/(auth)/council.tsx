import { Button } from '@/src/components/ui/Button';
import { Text } from '@/src/components/ui/Text';
import { useContent } from '@/src/providers/ContentProvider';
import { useStores } from '@/src/providers/StoreProvider';
import { useTheme } from '@/src/providers/ThemeProvider';
import { useHeaderHeight } from '@react-navigation/elements';
import { router } from 'expo-router';
import { observer } from 'mobx-react-lite';
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    View
} from 'react-native';

export default observer(function CouncilScreen() {
    const { space, colors } = useTheme();
    const { copy } = useContent();
    const acStore = useStores().accountCreationStore;
    const headerHeight = useHeaderHeight();

    function onSelectCouncil(councilId: string) {
        acStore.setSelectedCouncil(councilId);
    }

    async function onSubmit() {
        if (!acStore.selectedCouncilId || acStore.binSystemLookUpLoading) return;
        console.log("Submitting council", acStore.selectedCouncilId);
        try {
            await acStore.lookUpBinSystem();
            if (acStore.binSystemLookUpError) return;
            router.push({ pathname: '/(auth)/binsystem' });
        } catch (error) {
            console.log("Error submitting council:", error);
        }
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
                        {copy.screens.council.title}
                    </Text>

                    <Text size={16} style={[styles.subtitle, { color: colors.muted }]}>
                        {copy.screens.council.subtitle}
                    </Text>

                    <Text size={14} style={[styles.description, { color: colors.muted }]}>
                        {copy.screens.council.description}
                    </Text>

                    <View style={styles.councilList}>
                        {acStore.councils.map((council) => (
                            <Pressable
                                key={council.id}
                                style={[
                                    styles.councilItem,
                                    {
                                        borderColor: acStore.selectedCouncilId === council.id 
                                            ? colors.primary 
                                            : colors.muted,
                                        backgroundColor: colors.bg,
                                    }
                                ]}
                                onPress={() => onSelectCouncil(council.id)}
                            >
                                <Text 
                                    size={16} 
                                    style={{
                                        color: acStore.selectedCouncilId === council.id 
                                            ? colors.primary 
                                            : colors.text
                                    }}
                                >
                                    {council.name}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                </ScrollView>

                <View style={[styles.ctaWrap, { paddingHorizontal: space.lg, paddingBottom: space.lg }]}>
                    <Button
                        title={acStore.binSystemLookUpLoading ? copy.screens.council.ctaSubmitting : copy.screens.council.ctaContinue}
                        onPress={onSubmit}
                        style={{ opacity: acStore.selectedCouncilId && !acStore.binSystemLookUpLoading ? 1 : 0.5 }}
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
    title: { marginBottom: 8, lineHeight: 48 },
    subtitle: { marginBottom: 8 },
    description: { marginBottom: 32, lineHeight: 20 },
    councilList: { gap: 12 },
    councilItem: {
        padding: 20,
        borderRadius: 12,
        borderWidth: 2,
    },
    ctaWrap: {},
});