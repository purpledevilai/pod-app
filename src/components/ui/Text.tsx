import { useTheme } from '@/src/providers/ThemeProvider';
import { Text as RNText, StyleSheet, TextProps, TextStyle } from 'react-native';

type Props = TextProps & {
  weight?: 'regular' | 'semibold';
  color?: string;
  size?: number;
};

export function Text({ style, weight = 'regular', color, size, ...rest }: Props) {
  const { fonts, colors } = useTheme();
  const family = weight === 'semibold' ? fonts.semibold : fonts.regular;

  return (
    <RNText
      {...rest}
      style={[
        styles.base,
        { color: color ?? colors.text, fontFamily: family } as TextStyle,
        // ✅ only add when defined; never returns 0
        size !== undefined ? ({ fontSize: size } as TextStyle) : undefined,
        style as any,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: { fontSize: 16, lineHeight: 22 },
});
