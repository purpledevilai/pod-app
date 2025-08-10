import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';

export function useAppLifecycle(onReopen?: () => void) {
  const last = useRef<AppStateStatus>(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (last.current.match(/inactive|background/) && next === 'active') onReopen?.();
      last.current = next;
    });
    return () => sub.remove();
  }, [onReopen]);
}