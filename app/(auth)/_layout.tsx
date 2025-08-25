// app/(auth)/_layout.tsx
import { useAuthStore } from '@/src/providers/StoreProvider';
import { useTheme } from '@/src/providers/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, router, Stack } from 'expo-router';
import { observer } from 'mobx-react-lite';
import { Image, Pressable } from 'react-native';

export default observer(function AuthLayout() {
  const auth = useAuthStore();
  const { colors } = useTheme();
  if (auth.session) return <Redirect href="/(app)" />;

  return (
    <Stack
      screenOptions={{
        // ✅ header ON for all screens by default
        headerShown: true,
        headerShadowVisible: false,
        headerTintColor: colors.text,                 // default back icon color
        headerStyle: { backgroundColor: colors.bg },  // header background
        contentStyle: { backgroundColor: colors.bg }, // screen background under header
        headerTitleAlign: 'left',
        headerTitle: () => (
          <Image
            source={require('@/assets/images/pod.png')}
            style={{ width: 80, height: 80 }}
            resizeMode="contain"
          />
        ),
        headerLeft: () => (
          <Pressable onPress={() => router.back()} hitSlop={12} style={{ padding: 4, marginLeft: 6 }}>
            <Ionicons name="chevron-back" size={28} color={colors.text} />
          </Pressable>
        ),
        // DO NOT set headerTransparent here
      }}
    >
      {/* ⛔️ Hide header only on the very first auth screen */}
      <Stack.Screen name="index" options={{ headerShown: false }} />

      {/* Others inherit the defaults; override per-screen if needed */}
      <Stack.Screen name="welcome" />
      {/* e.g. email, verify ... */}
    </Stack>
  );
})
