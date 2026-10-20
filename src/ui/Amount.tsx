import { Text, View } from 'react-native';

import { splitGhs, type Pesewas } from '@/domain/money';

interface AmountProps {
  amount: Pesewas;
  /** Prefix drawn before the currency: `−` or `+`. */
  sign?: string;
  /** `inverse` is for the dark hero. */
  tone?: 'ink' | 'inverse';
}

/** The big number: whole cedis heavy, pesewas lighter (design.md 2). */
export function Amount({ amount, sign = '', tone = 'ink' }: AmountProps) {
  const { whole, fraction } = splitGhs(amount);
  return (
    <View className="flex-row items-baseline gap-1">
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
