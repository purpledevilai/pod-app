// app/index.tsx
import { useAuthStore } from '@/src/providers/StoreProvider';
import { Redirect } from 'expo-router';
import { observer } from 'mobx-react-lite';

export default observer(function Index() {
  const auth = useAuthStore();          // Gate ensures this is ready
  return <Redirect href={auth.session ? '/(app)' : '/(auth)'} />;
});
