import { Pressable, Text, View } from 'react-native';

import { formatGhs, formatPlain, type Pesewas } from '@/domain/money';
import type { TransactionRow as Row } from '@/domain/transaction/transaction';
import { Icon } from '@/ui';

import { categoryById, categoryIcon, useCategories } from '@/features/categories';

interface Props {
  row: Row;
  when?: string;
  padding?: 'py-3' | 'py-[14px]';
  onPress?: () => void;
  onAddNote?: () => void;
  /** A cash-out with something left to break down: opens the allocations sheet. */
  breakDown?: { left: Pesewas; onPress: () => void } | undefined;
}

export function TransactionRow({
  row,
  when,
  padding = 'py-3',
  onPress,
  onAddNote,
  breakDown,
}: Props) {
  useCategories();
  const category = categoryById(row.categoryId);
  const incoming = row.direction === 'in';
  // Same rule as Home's "What were these for?" card: a payment out that no category claimed.
  const needsNote =
    row.note === null &&
    !incoming &&
    !row.manual &&
    (row.categoryId === null || row.categoryId === 'other');

  // The caller passes `breakDown` only for a cash-out that is still asking (`cashOutPrompts`) or
  // already partly broken down, and that has something left.
  const asksCashUse = breakDown !== undefined && !incoming;

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

  const subtitle = [category?.name, row.note, when, row.manual ? 'Added by you' : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      testID={`transactionRow-${row.id}`}
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
        {asksCashUse ? (
          <Text
            testID={`cashAllocLink-${row.id}`}
            onPress={breakDown.onPress}
            className="font-inter-semibold text-[13px] leading-[18px] text-ink underline"
          >
            Break it down · {formatGhs(breakDown.left)} left
          </Text>
        ) : needsNote ? (
          <Text
            testID={`addNoteLink-${row.id}`}
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
        numberOfLines={1}
        className={`w-[88px] shrink-0 text-right font-tight-bold text-body tabular-nums ${incoming ? 'text-income' : 'text-ink'}`}
      >
        {incoming ? '+' : '−'}
        {formatPlain(row.amount)}
      </Text>
    </Pressable>
  );
}
