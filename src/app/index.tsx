import { Text, View } from 'react-native';

export default function Home() {
  return (
    <View className="flex-1 items-center justify-center bg-ground">
      <View className="rounded-chip border-hard border-ink bg-signal px-6 py-4">
        <Text className="text-2xl font-extrabold text-ink">momo-spend</Text>
      </View>
    </View>
  );
}
