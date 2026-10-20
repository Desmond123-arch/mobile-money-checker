import { Pressable, Text, View } from 'react-native';

import { formatPlain } from '@/domain/money';
import type { TransactionRow as Row } from '@/domain/transaction/transaction';
import { Icon } from '@/ui';

import { categoryById, categoryIcon } from '@/features/categories';

interface Props {
  row: Row;
  /** Appended to the subtitle on Home ("Today"). */
  when?: string;
  padding?: 'py-3' | 'py-[14px]';
  onPress?: () => void;
  onAddNote?: () => void;
}

/** Icon disc, title and subtitle, amount in a fixed 80px lane so amounts align down the list. */
export function TransactionRow({ row, when, padding = 'py-3', onPress, onAddNote }: Props) {
  const category = categoryById(row.categoryId);
  const incoming = row.direction === 'in';
  const needsNote = row.note === null;

  const disc = needsNote
    ? { bg: '#F5B800', icon: 'exclaim' as const, stroke: '#14110F', width: 2 }
    : incoming
      ? { bg: '#14110F', icon: 'arrowIn' as const, stroke: '#7FE0A8', width: 2 }
      : {
          bg: category?.tint ?? '#EDEDED',
          icon: categoryIcon(row.categoryId),
          stroke: '#14110F',
          width: 1.8,
        };

  const subtitle = [category?.name, row.note, when].filter(Boolean).join(' · ');

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={`flex-row items-center gap-[14px] ${padding}`}
    >
      <View
        className="size-11 shrink-0 items-center justify-center rounded-[22px]"
        style={{ backgroundColor: disc.bg }}
      >
        <Icon name={disc.icon} size={22} color={disc.stroke} strokeWidth={disc.width} />
      </View>
      <View className="min-w-0 flex-1 gap-[2px]">
        <Text numberOfLines={1} className="font-inter-semibold text-body leading-[22px] text-ink">
          {row.counterparty}
        </Text>
        {needsNote ? (
          <Text
            onPress={onAddNote}
            className="font-inter-semibold text-[13px] leading-[18px] text-ink underline"
          >
            Add a note
          </Text>
        ) : (
          <Text numberOfLines={1} className="font-inter text-caption leading-[18px] text-muted">
            {subtitle}
          </Text>
        )}
      </View>
      <Text
        className={`w-20 shrink-0 text-right font-tight-bold text-body tabular-nums ${incoming ? 'text-income' : 'text-ink'}`}
      >
        {incoming ? '+' : '−'}
        {formatPlain(row.amount)}
      </Text>
    </Pressable>
  );
}
