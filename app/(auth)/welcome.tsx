import { Button } from '@/src/components/ui/Button';
import { Text } from '@/src/components/ui/Text';
import { useTheme } from '@/src/providers/ThemeProvider';
import { ScrollView, StyleSheet, View } from 'react-native';

export default function Welcome() {
  const { colors, space } = useTheme();

  return (
    <View style={[styles.container, { paddingHorizontal: space.lg }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: space.xl }}>

        <Text weight="semibold" size={40} style={styles.title}>
          Welcome to Pod
        </Text>

        <Text color={colors.muted} size={20} style={styles.p}>
          We’re so glad you’re here.
        </Text>

        <Text color={colors.muted} size={20} style={styles.p}>
          Pod is more than an app — it’s a community committed to transforming
          how we relate to the materials in our lives. Together, we’re working
          to supercharge the circular economy and reduce our impact on the planet.
        </Text>

        <Text color={colors.muted} size={20} style={styles.p}>
          Every day, we extract more from the Earth — while landfills overflow
          with untapped potential. But it doesn’t have to be that way.
        </Text>

        <Text color={colors.muted} size={20} style={styles.p}>
          We believe that with better guidance, we can all make choices that
          integrate with — not work against — our planet’s ecosystem.
        </Text>

        <Text color={colors.muted} size={20} style={styles.p}>
          And it starts right here, with you, in your home.
        </Text>

        <Text color={colors.muted} size={20} style={[styles.p, { marginBottom: space.xl }]}>
          Join us, and let’s begin.
        </Text>
      </ScrollView>

      {/* CTA pinned to bottom */}
      <View style={{ paddingBottom: space.lg }}>
        <Button title="Next" onPress={() => {}} />
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
