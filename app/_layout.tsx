import { ContentProvider } from '@/src/providers/ContentProvider';
import { StoreProvider, useStores } from '@/src/providers/StoreProvider';
import { ThemeProvider } from '@/src/providers/ThemeProvider';
import { Outfit_400Regular as Outfit, Outfit_600SemiBold as OutfitSemi } from '@expo-google-fonts/outfit';
import { useFonts } from 'expo-font';
import { router, Slot } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { observer } from 'mobx-react-lite';
import { useEffect } from 'react';

SplashScreen.preventAutoHideAsync();

export default function Root() {
  return (
    <StoreProvider>
      <ThemeProvider>
        <ContentProvider>
          <Gate />
        </ContentProvider>
      </ThemeProvider>
    </StoreProvider>
  );
}

const Gate = observer(function Gate() {
  const { bootstrapped, authStore } = useStores();
  const [fontsLoaded] = useFonts({ Outfit, OutfitSemi });
  const allReady = bootstrapped && fontsLoaded;

  useEffect(() => {
    if (allReady) SplashScreen.hideAsync();
  }, [allReady]);

  // Handle navigation based on auth state
  useEffect(() => {
    if (allReady) {
      if (!authStore.isLoggedIn) {
        router.replace('/(auth)');
      }
    }
  }, [allReady, authStore.isLoggedIn]);
  
  if (!allReady) return null;

  return (
    <>
      <StatusBar style="dark" />
      <Slot />
    </>
  );
});
