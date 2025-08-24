import { useTheme } from '@/src/providers/ThemeProvider';
import { forwardRef, useState } from 'react';
import { StyleSheet, TextInput, TextInputProps, View } from 'react-native';
import { Text } from './Text';

type Props = TextInputProps & { error?: string };

export const Input = forwardRef<TextInput, Props>(({ error, style, ...rest }, ref) => {
    const { colors, radii } = useTheme();
    const [focused, setFocused] = useState(false);

    return (
        <View>
            <TextInput
                ref={ref}
                {...rest}
                onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
                onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
                placeholderTextColor="#9FA4A4"
                style={[
                    styles.input,
                    {
                        borderColor: focused ? colors.text : '#6E726F',
                        borderRadius: radii.lg,
                    },
                    style,
                ]}
            />
            {!!error && (
                <Text size={14} color="#C0392B" style={{ marginTop: 6 }}>
                    {error}
                </Text>
            )}
        </View>
    );
});

const styles = StyleSheet.create({
    input: {
        height: 68,
        borderWidth: 2,
        paddingHorizontal: 20,
        fontSize: 20,
    },
});
