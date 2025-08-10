import { AuthProvider, useAuthBootstrapReady } from '@/src/providers/AuthProvider';
import { ThemeProvider } from '@/src/providers/ThemeProvider';
import { Outfit_400Regular as Outfit, Outfit_600SemiBold as OutfitSemi } from '@expo-google-fonts/outfit';
import { useFonts } from 'expo-font';
import { Slot } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

SplashScreen.preventAutoHideAsync();

export default function Root() {
  const [fontsLoaded] = useFonts({ Outfit, OutfitSemi });
  return (
    <AuthProvider>
      <ThemeProvider>
        <Gate ready={fontsLoaded} />
      </ThemeProvider>
    </AuthProvider>
  );
}

function Gate({ ready }: { ready: boolean }) {
  const authReady = useAuthBootstrapReady();
  const allReady = ready && authReady;

  useEffect(() => { if (allReady) SplashScreen.hideAsync(); }, [allReady]);
  if (!allReady) return null;

  return (
    <>
      <StatusBar style="dark" />{/* dark text on light bg */}
      <Slot />
    </>
  );
}
