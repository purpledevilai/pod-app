import { useTheme } from '@/src/providers/ThemeProvider';
import { Stack } from 'expo-router';
import React from 'react';

export default function AppLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="landing" />
      <Stack.Screen name="profile" />
    </Stack>
  );
}