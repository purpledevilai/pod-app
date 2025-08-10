import { Text } from '@/src/components/ui/Text';
import { View } from 'react-native';

export default function Home() {
  return (
    <View style={{ flex: 1, padding: 24 }}>
      <Text weight="semibold" size={24}>Home</Text>
    </View>
  );
}