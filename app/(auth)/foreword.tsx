import { Button } from '@/src/components/ui/Button';
import { Markdown } from '@/src/components/ui/Markdown';
import { Text } from '@/src/components/ui/Text';
import { useContent } from '@/src/providers/ContentProvider';
import { useTheme } from '@/src/providers/ThemeProvider';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';


export default function Foreword() {
  const { space } = useTheme();
  const { copy } = useContent();

  return (
    <View style={[styles.container, { paddingHorizontal: space.lg }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: space.xl }}>

        <Text weight="semibold" size={40} style={styles.title}>
            {copy.screens.foreword.title}
        </Text>

        <Text weight="semibold" size={24} style={styles.title}>
            {copy.screens.foreword.foreword}
        </Text>

        <Markdown>{copy.screens.foreword.bodyMd}</Markdown>
      </ScrollView>

      {/* CTA pinned to bottom */}
      <View style={{ paddingBottom: space.lg }}>
        <Button title={copy.screens.foreword.ctaContinue} onPress={() => router.push('/(auth)/email')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  logo: { alignSelf: 'center', width: 96, height: 48, marginTop: 24 },
  title: { marginTop: 24, marginBottom: 12, lineHeight: 46 },
  p: { marginTop: 18, lineHeight: 28 },
});
