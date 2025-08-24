// src/components/ui/Text.tsx
import { useTheme } from '@/src/providers/ThemeProvider';
import { Text as RNText, StyleSheet, TextProps, TextStyle } from 'react-native';

type Props = TextProps & {
  weight?: 'regular' | 'semibold';
  color?: string;
  size?: number;
  lh?: number; // optional explicit lineHeight
};

export function Text({ style, weight = 'regular', color, size, lh, ...rest }: Props) {
  const { fonts, colors } = useTheme();
  const family = weight === 'semibold' ? fonts.semibold : fonts.regular;

  const fontSize = size ?? 16;
  const lineHeight = lh ?? (size ? Math.round(fontSize * 1.25) : 22); // auto

  return (
    <RNText
      {...rest}
      style={[
        styles.base,
        { fontFamily: family, color: color ?? colors.text, fontSize, lineHeight } as TextStyle,
        style as any,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {}, // no fixed lineHeight here
});
