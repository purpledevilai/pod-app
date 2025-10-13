import { useTheme } from '@/src/providers/ThemeProvider';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

interface OrbProps {
    isConnecting: boolean;
    isUserSpeaking: boolean;
    isAISpeaking: boolean;
    size?: number;
}

/**
 * Orb - Visual indicator for conversation state
 * Colors:
 * - Gray: Idle/waiting
 * - Blue: User is speaking
 * - Green: AI is speaking
 * Shows spinner when connecting
 */
export const Orb = ({ 
    isConnecting, 
    isUserSpeaking, 
    isAISpeaking,
    size = 100 
}: OrbProps) => {
    const { colors } = useTheme();

    // Determine orb color based on state
    const getOrbColor = () => {
        if (isUserSpeaking) return colors.primary; // Blue when user speaks
        if (isAISpeaking) return '#10B981'; // Green when AI speaks
        return colors.muted; // Gray when idle
    };

    if (isConnecting) {
        return (
            <View style={[styles.container, { width: size, height: size }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <View 
            style={[
                styles.orb,
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: getOrbColor(),
                    shadowColor: getOrbColor(),
                }
            ]}
        />
    );
};

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    orb: {
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 20,
        elevation: 10,
    },
});

