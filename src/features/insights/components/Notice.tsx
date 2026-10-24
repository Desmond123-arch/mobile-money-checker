import { Text, View } from 'react-native';

export function Notice({ testID, title, body }: { testID: string; title: string; body: string }) {
  return (
    <View testID={testID} className="items-start gap-2 pt-4">
      <Text className="font-tight-extrabold text-[22px] leading-[29px] text-ink">{title}</Text>
      <Text className="font-inter text-body leading-6 text-muted">{body}</Text>
    </View>
  );
}
