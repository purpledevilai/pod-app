import { Button } from '@/src/components/ui/Button';
import { Text } from '@/src/components/ui/Text';
import { useStores } from '@/src/providers/StoreProvider';
import { View } from 'react-native';

export default function Home() {
  const { authStore } = useStores();
  return (
    <View style={{ flex: 1, padding: 24 }}>
      <Text weight="semibold" size={24}>Home</Text>
      <View style={{ marginTop: 24 }}>
        <Button title="Logout" onPress={() => {
          console.log("Logging out...");
          authStore.logout()}} />
      </View>
    </View>
  );
}