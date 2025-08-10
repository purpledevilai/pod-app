import { useTheme } from '@/src/providers/ThemeProvider';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import { Text } from './Text';

type Props = { title: string; onPress: () => void; style?: ViewStyle };

export function Button({ title, onPress, style }: Props) {
    const { colors, radii } = useTheme();
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [styles.btn, { backgroundColor: colors.primary, borderRadius: radii.pill }, pressed && { opacity: 0.9 }, style]}
        >
            <Text weight="semibold" size={20} color={colors.onPrimary}>
                {title}
            </Text>
        </Pressable>
    );
}
const styles = StyleSheet.create({
    btn: { height: 68, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
});
