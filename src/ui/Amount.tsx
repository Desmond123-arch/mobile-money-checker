import { Text, View } from 'react-native';

import { splitGhs, type Pesewas } from '@/domain/money';

interface AmountProps {
  amount: Pesewas;
  sign?: string;
  tone?: 'ink' | 'inverse';
  size?: 'lg' | 'md';
  testID?: string;
}

export function Amount({ amount, sign = '', tone = 'ink', size = 'lg', testID }: AmountProps) {
  const { whole, fraction } = splitGhs(amount);
  return (
    <View testID={testID} className="flex-row items-baseline gap-1">
      <Text
        className={`font-tight-extrabold tabular-nums tracking-[-0.03em] ${size === 'lg' ? 'text-[54px] leading-[60px]' : 'text-[34px] leading-[40px]'} ${tone === 'ink' ? 'text-ink' : 'text-ground'}`}
      >
        {sign}
        {whole}
      </Text>
      <Text
        className={`font-tight-medium tabular-nums ${size === 'lg' ? 'text-[30px] leading-10' : 'text-[20px] leading-[28px]'} ${tone === 'ink' ? 'text-muted' : 'text-white/60'}`}
      >
        {fraction}
      </Text>
    </View>
  );
}
