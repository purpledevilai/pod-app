import { Text } from '@/src/components/ui/Text';
import { useTheme } from '@/src/providers/ThemeProvider';
import { Image, ScrollView, StyleSheet, View } from 'react-native';

/**
 * ARLAndRICView - Displays the Australian Recycling Label and Resin Identification Code
 * Used to help users identify recycling symbols on packaging
 */
export const ARLAndRICView = () => {
    const { colors } = useTheme();

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
        >
            {/* Title */}
            <Text weight="semibold" size={20} style={{ color: colors.text, textAlign: 'center' }}>
                Recycling Labels
            </Text>
            <Text weight="regular" size={14} style={{ color: colors.muted, textAlign: 'center', marginTop: 8 }}>
                Look for these symbols on your packaging
            </Text>

            {/* Australian Recycling Label */}
            <View style={styles.imageSection}>
                <Text weight="semibold" size={16} style={{ color: colors.text, marginBottom: 12 }}>
                    Australian Recycling Label (ARL)
                </Text>
                <Image
                    source={require('@/assets/images/arl_label_example.png')}
                    style={styles.image}
                    resizeMode="contain"
                />
            </View>

            {/* Resin Identification Code */}
            <View style={styles.imageSection}>
                <Text weight="semibold" size={16} style={{ color: colors.text, marginBottom: 12 }}>
                    Resin Identification Code (RIC)
                </Text>
                <Image
                    source={require('@/assets/images/ric_example.png')}
                    style={styles.image}
                    resizeMode="contain"
                />
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    contentContainer: {
        paddingVertical: 16,
        gap: 24,
    },
    imageSection: {
        alignItems: 'center',
    },
    image: {
        width: '100%',
        height: 200,
    },
});

