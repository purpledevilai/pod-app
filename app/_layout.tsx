import { ContentProvider } from '@/src/providers/ContentProvider';
import { StoreProvider, useStores } from '@/src/providers/StoreProvider';
import { ThemeProvider } from '@/src/providers/ThemeProvider';
import { Outfit_400Regular as Outfit, Outfit_600SemiBold as OutfitSemi } from '@expo-google-fonts/outfit';
import { useFonts } from 'expo-font';
import { Slot } from 'expo-router';
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
  const storesReady = useStores().bootstrapped;
  const [fontsLoaded] = useFonts({ Outfit, OutfitSemi });
  const allReady = storesReady && fontsLoaded;

  useEffect(() => {
    if (allReady) SplashScreen.hideAsync();
  }, [allReady]);
  
  if (!allReady) return null;

  return (
    <>
      <StatusBar style="dark" />
      <Slot />
    </>
  );
});
