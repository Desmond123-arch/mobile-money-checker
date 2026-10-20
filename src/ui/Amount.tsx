import { Text, View } from 'react-native';

import { splitGhs, type Pesewas } from '@/domain/money';

interface AmountProps {
  amount: Pesewas;
  sign?: string;
  tone?: 'ink' | 'inverse';
  testID?: string;
}

export function Amount({ amount, sign = '', tone = 'ink', testID }: AmountProps) {
  const { whole, fraction } = splitGhs(amount);
  return (
    <View testID={testID} className="flex-row items-baseline gap-1">
      <Text
        className={`font-tight-extrabold text-[54px] tabular-nums leading-[60px] tracking-[-0.03em] ${tone === 'ink' ? 'text-ink' : 'text-ground'}`}
      >
        {sign}
        {whole}
      </Text>
      <Text
        className={`font-tight-medium text-[30px] tabular-nums leading-10 ${tone === 'ink' ? 'text-muted' : 'text-white/60'}`}
      >
        {fraction}
      </Text>
    </View>
  );
}
