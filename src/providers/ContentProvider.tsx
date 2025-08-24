import { copy, type AppCopy } from '@/src/content/copy';
import { createContext, useContext } from 'react';

type Ctx = { copy: AppCopy; c: (path: string) => string };
const ContentCtx = createContext<Ctx>({ copy, c: (p) => p });

export function ContentProvider({ children }: { children: React.ReactNode }) {
  // local-only for now — no fetching, no caching
  const c = (path: string) => get(copy, path) ?? path;
  return <ContentCtx.Provider value={{ copy, c }}>{children}</ContentCtx.Provider>;
}

export const useContent = () => useContext(ContentCtx);

// tiny dot-path getter
function get(obj: any, path: string) {
  return path.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
}
