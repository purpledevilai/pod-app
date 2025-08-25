// app/_layout.tsx
import { ContentProvider } from '@/src/providers/ContentProvider';
import { StoreProvider, useRootReady } from '@/src/providers/StoreProvider';
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
  const [fontsLoaded] = useFonts({ Outfit, OutfitSemi });

  return (
    <StoreProvider>
      <ThemeProvider>
        <ContentProvider>
          <Gate ready={fontsLoaded} />
        </ContentProvider>
      </ThemeProvider>
    </StoreProvider>
  );
}

const Gate = observer(function Gate({ ready }: { ready: boolean }) {
  const storesReady = useRootReady();
  const allReady = ready && storesReady;

  useEffect(() => { if (allReady) SplashScreen.hideAsync(); }, [allReady]);
  if (!allReady) return null;

  return (
    <>
      <StatusBar style="dark" />
      <Slot />
    </>
  );
});
