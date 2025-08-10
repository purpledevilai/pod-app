import { Button } from '@/src/components/ui/Button';
import { Text } from '@/src/components/ui/Text';
import { useTheme } from '@/src/providers/ThemeProvider';
import { router } from 'expo-router';
import { Image, StyleSheet, View } from 'react-native';

export default function StartScreen() {
  const { colors, space } = useTheme();

  return (
    <View style={[styles.container, { paddingHorizontal: space.lg }]}>
      {/* Top block: logo + tagline */}
      <View style={styles.top}>
        <Image
          source={require('@/assets/images/pod.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text
          weight="semibold"
          color={colors.muted}
          size={30}
          style={styles.tagline}
        >
          Everything{'\n'}becomes{'\n'}something.
        </Text>
      </View>

      {/* Spacer pushes CTA to the bottom */}
      <View style={{ flex: 1 }} />

      {/* Bottom CTA */}
      <View style={{ paddingBottom: space.lg }}>
        <Button title="Get Started" onPress={() => router.push('/(auth)/welcome')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  top: {
    alignItems: 'center',
    paddingTop: 64, // keep your original top offset
  },
  logo: { width: '100%', height: 180 },
  tagline: {
    marginTop: 16,          // <- moves it closer to the logo
    textAlign: 'center',
    lineHeight: 40,
    letterSpacing: 0.2,
  },
});
