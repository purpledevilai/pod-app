import { MenuDrawer } from '@/src/components/MenuDrawer';
import { useTheme } from '@/src/providers/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import React, { useState } from 'react';
import { Image, Pressable } from 'react-native';

export default function AppLayout() {
  const { colors } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: true,
          headerShadowVisible: false,
          headerTintColor: colors.text,
          headerStyle: { backgroundColor: colors.bg },
          contentStyle: { backgroundColor: colors.bg },
          headerTitleAlign: 'center',
          headerTitle: () => (
            <Image
              source={require('@/assets/images/pod.png')}
              style={{ width: 80, height: 60 }}
              resizeMode="contain"
            />
          ),
          headerLeft: () => (
            <Pressable 
              onPress={() => setIsMenuOpen(true)} 
              hitSlop={12} 
              style={{ padding: 4, marginLeft: 6 }}
            >
              <Ionicons name="menu" size={28} color={colors.text} />
            </Pressable>
          ),
          headerRight: () => null, // Empty right side
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="landing" />
      </Stack>
      
      <MenuDrawer 
        isOpen={isMenuOpen} 
        onClose={() => setIsMenuOpen(false)} 
      />
    </>
  );
}