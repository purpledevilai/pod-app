import { Image, StyleSheet, View } from 'react-native';

export default function LandingScreen() {
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
