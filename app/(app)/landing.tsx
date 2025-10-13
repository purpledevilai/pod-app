import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';

export default function LandingScreen() {
    const router = useRouter();

    useEffect(() => {
        // Auto-navigate to index after 5 seconds
        const timer = setTimeout(() => {
            router.replace('/(app)');
        }, 3000);

        // Clean up timer on unmount
        return () => clearTimeout(timer);
    }, [router]);

    return (
        <View style={styles.container}>
            <Image
                source={require('@/assets/images/pod.png')}
                style={styles.logo}
                resizeMode="contain"
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
    },
    logo: {
        width: 200,
        height: 200,
    },
});
