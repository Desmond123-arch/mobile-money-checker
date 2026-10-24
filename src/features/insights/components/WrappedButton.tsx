import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import type { Pesewas } from '@/domain/money';
import { hasWrapped, type WrappedScope } from '@/domain/summary/wrapped';
import { wrappedParams } from '@/features/wrapped';
import { Button } from '@/ui';

/** The way into the story recap. With no spending in the scope it is dimmed and says why. */
export function WrappedButton({
  scope,
  spent,
  payments,
  emptyNote,
}: {
  scope: WrappedScope;
  spent: Pesewas;
  payments: number;
  emptyNote: string;
}) {
  const router = useRouter();
  const ready = hasWrapped({ spent, payments });
  return (
    <View className="gap-2 pt-6">
      <Button
        testID="wrappedBtn"
        label="View your wrapped"
        disabled={!ready}
        onPress={() => router.push({ pathname: '/wrapped', params: wrappedParams(scope) })}
      />
      {ready ? null : (
        <Text testID="wrappedNote" className="font-inter text-[14px] leading-5 text-muted">
          {emptyNote}
        </Text>
      )}
    </View>
  );
}
