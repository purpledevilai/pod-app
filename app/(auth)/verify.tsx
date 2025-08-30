import { Button } from '@/src/components/ui/Button';
import { Markdown } from '@/src/components/ui/Markdown';
import { Text } from '@/src/components/ui/Text';
import { useContent } from '@/src/providers/ContentProvider';
import { useStores } from '@/src/providers/StoreProvider';
import { useTheme } from '@/src/providers/ThemeProvider';
import { useHeaderHeight } from '@react-navigation/elements';
import { router } from 'expo-router';
import { useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';

export default function VerifyScreen() {
    const { space } = useTheme();
    const { copy } = useContent();
    const authStore = useStores().authStore;
    const [code, setCode] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | undefined>();

    const headerHeight = useHeaderHeight();
    const valid = code.length === 6;

    async function onSubmit() {
        if (!valid || submitting) return;
        try {
            setSubmitting(true);
            setError(undefined);
            const result = await authStore.verifyCode(code);
            if (result.status === 'logged_in') {
                console.log("Logged in, redirecting to app");
                router.replace('/(app)');
            } else if (result.status === 'needs_account') {
                console.log("Needs account, redirecting to create account");
                router.push('/(auth)/foreword');
            } else {
                console.log("Invalid code result:", result);
                setError(result.message || 'Invalid code, try again.');
            }
        } catch (e) {
            console.log("Error verifying code:", e);
            setError('Something went wrong. Please try again.');
        } finally {
            setSubmitting(false);
        }
    }

    async function resend() {
        try {
            if (!authStore.email) throw new Error("No email to verify");
            await authStore.sendEmailVerification(authStore.email)
        } catch {
            setError('Could not resend code. Try again.');
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
                        {copy.screens.verify.title}
                    </Text>

                    <Markdown>{copy.screens.verify.bodyMd}</Markdown>

                    {/* 6-digit code input */}
                    <View style={styles.codeWrap}>
                        <TextInput
                            style={styles.codeInput}
                            keyboardType="number-pad"
                            maxLength={6}
                            value={code}
                            onChangeText={setCode}
                            returnKeyType="done"
                            onSubmitEditing={onSubmit}
                            textAlign="center"
                        />
                    </View>

                    {error && (
                        <Text color="red" style={{ marginTop: space.sm }}>
                            {error}
                        </Text>
                    )}

                    <View style={styles.links}>
                        <Text color="muted" onPress={resend}>
                            {copy.screens.verify.resend}
                        </Text>
                        <Text
                            color="muted"
                            onPress={() => router.back()}
                            style={{ marginTop: space.sm }}
                        >
                            {copy.screens.verify.useDifferentEmail}
                        </Text>
                    </View>
                </ScrollView>

                <View style={[styles.ctaWrap, { paddingHorizontal: space.lg, paddingBottom: space.lg }]}>
                    <Button
                        title={submitting ? copy.screens.verify.ctaSubmitting : copy.screens.verify.ctaContinue}
                        onPress={onSubmit}
                        style={{ opacity: valid && !submitting ? 1 : 0.5 }}
                    />
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
    container: { flex: 1 },
    scrollContent: { flexGrow: 1 },
    title: { marginBottom: 12, lineHeight: 48 },
    codeWrap: { marginTop: 28, alignItems: 'center' },
    codeInput: {
        fontSize: 32,
        letterSpacing: 16,
        borderBottomWidth: 1,
        borderColor: '#ccc',
        paddingVertical: 8,
        width: 220,
    },
    links: { marginTop: 20, alignItems: 'center' },
    ctaWrap: {},
});
