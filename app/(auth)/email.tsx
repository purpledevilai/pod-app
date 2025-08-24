import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { Markdown } from '@/src/components/ui/Markdown';
import { Text } from '@/src/components/ui/Text';
import { useSession } from '@/src/providers/AuthProvider';
import { useContent } from '@/src/providers/ContentProvider';
import { useTheme } from '@/src/providers/ThemeProvider';
import { useHeaderHeight } from '@react-navigation/elements';
import { useRef, useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';

export default function EmailScreen() {
    const { space } = useTheme();
    const { copy } = useContent();
    const { startEmailLogin } = useSession();
    const [email, setEmail] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | undefined>();
    const inputRef = useRef<TextInput>(null);

    const headerHeight = useHeaderHeight();
    const valid = isEmail(email);

    async function onSubmit() {
        if (!valid || submitting) return;
        try {
            setSubmitting(true);
            setError(undefined);
            await startEmailLogin(email.trim());
            // router.push({ pathname: '/(auth)/verify', params: { email: email.trim() } });
        } catch {
            setError('Something went wrong. Please try again.');
        } finally {
            setSubmitting(false);
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
                        {copy.screens.email.title}
                    </Text>

                    <Markdown>{copy.screens.email.bodyMd}</Markdown>

                    <View style={styles.fieldWrap}>
                        <Input
                            ref={inputRef}
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            autoCorrect={false}
                            keyboardType="email-address"
                            textContentType="emailAddress"
                            returnKeyType="done"
                            onSubmitEditing={onSubmit}
                            placeholder={copy.screens.email.placeholder}
                            error={!valid && email.length > 0 ? copy.screens.email.errorInvalid : error}
                        />
                    </View>
                </ScrollView>

                <View style={[styles.ctaWrap, { paddingHorizontal: space.lg, paddingBottom: space.lg }]}>
                    <Button
                        title={submitting ? copy.screens.email.ctaSubmitting : copy.screens.email.ctaSend}
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
    title: { marginBottom: 12, lineHeight: 48 }, // avoids clipping for size=40
    fieldWrap: { marginTop: 28 },
    ctaWrap: {},
});

function isEmail(s: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}
