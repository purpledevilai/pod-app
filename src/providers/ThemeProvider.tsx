import { theme, type Theme } from '@/src/theme/theme';
import { createContext, useContext } from 'react';
import { View } from 'react-native';

const Ctx = createContext<{ theme: Theme }>({ theme });
export const useTheme = () => useContext(Ctx).theme;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <Ctx.Provider value={{ theme }}>
      <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>{children}</View>
    </Ctx.Provider>
  );
}
