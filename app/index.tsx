import { useStores } from '@/src/providers/StoreProvider';
import { Redirect } from 'expo-router';
import { observer } from 'mobx-react-lite';

export default observer(function Index() {
  return <Redirect href={useStores().authStore.isLoggedIn ? '/(app)' : '/(auth)'} />;
});
