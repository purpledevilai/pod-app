import { useSession } from '@/src/providers/AuthProvider';
import { Redirect } from 'expo-router';

export default function Index() {
  const { session } = useSession();
  return <Redirect href={session ? '/(app)' : '/(auth)'} />;
}