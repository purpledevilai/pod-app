import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { Markdown } from '@/src/components/ui/Markdown';
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
    ScrollView,
    StyleSheet,
    View
} from 'react-native';

export default observer(function PostcodeScreen() {
    const { space } = useTheme();
    const { copy } = useContent();
    const acStore = useStores().accountCreationStore;
    const headerHeight = useHeaderHeight();

    async function onSubmit() {
        if (!acStore.postcodeValid || acStore.councilLookUpLoading) return;
        console.log("Submitting postcode", acStore.postcode);
        await acStore.lookUpCouncils();
        if (acStore.councilLookUpError) return;
        router.push({ pathname: '/(auth)/council' });
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
                        {copy.screens.postcode.title}
                    </Text>

                    <Markdown>{copy.screens.postcode.bodyMd}</Markdown>

                    <View style={styles.fieldWrap}>
                        <Input
                            value={acStore.postcode || ''}
                            onChangeText={acStore.setPostcode}
                            autoCapitalize="characters"
                            autoCorrect={false}
                            keyboardType="numeric"
                            returnKeyType="done"
                            onSubmitEditing={onSubmit}
                            placeholder={copy.screens.postcode.placeholder}
                            error={!acStore.postcodeValid && acStore.postcode?.length || 0 > 0 ? copy.screens.postcode.errorInvalid : acStore.councilLookUpError || undefined}
                        />
                    </View>
                </ScrollView>

                <View style={[styles.ctaWrap, { paddingHorizontal: space.lg, paddingBottom: space.lg }]}>
                    <Button
                        title={acStore.councilLookUpLoading ? copy.screens.postcode.ctaSubmitting : copy.screens.postcode.ctaLookUp}
                        onPress={onSubmit}
                        style={{ opacity: acStore.postcodeValid && !acStore.councilLookUpLoading ? 1 : 0.5 }}
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
    title: { marginBottom: 12, lineHeight: 48 },
    fieldWrap: { marginTop: 28 },
    ctaWrap: {},
});