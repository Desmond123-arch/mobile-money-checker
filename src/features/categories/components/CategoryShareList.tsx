import { Text, View } from 'react-native';

import { formatGhs } from '@/domain/money';
import { categoryShares, type CategorySpend } from '@/domain/category/share';

import { categoryById } from '../lookup';

/** The stacked share bar. Segments are flex-weighted by amount. */
export function ShareBar({ spend }: { spend: readonly CategorySpend[] }) {
  const shares = categoryShares(spend);
  return (
    <View className="h-4 flex-row gap-[2px]">
      {shares.map((s, i) => {
        const last = shares.length - 1;
        return (
          <View
            key={s.categoryId}
            style={{
              flex: s.amount,
              backgroundColor: categoryById(s.categoryId)?.color ?? '#9A9A9A',
              borderTopLeftRadius: i === 0 ? 8 : 3,
              borderBottomLeftRadius: i === 0 ? 8 : 3,
              borderTopRightRadius: i === last ? 8 : 3,
              borderBottomRightRadius: i === last ? 8 : 3,
            }}
          />
        );
      })}
    </View>
  );
}

/** One legend row per category: swatch, name, percent, amount in fixed lanes. */
export function ShareLegend({ spend, limit }: { spend: readonly CategorySpend[]; limit?: number }) {
  const rows = categoryShares(spend).slice(0, limit);
  return (
    <View className="pt-2">
      {rows.map((s, i) => {
        const category = categoryById(s.categoryId);
        return (
          <View
            key={s.categoryId}
            className={`flex-row items-center gap-3 py-3 ${i < rows.length - 1 ? 'border-b border-hairline' : ''}`}
          >
            <View
              className="size-3 rounded-[3px]"
              style={{ backgroundColor: category?.color ?? '#9A9A9A' }}
            />
            <Text className="flex-1 font-inter-medium text-body text-ink">
              {category?.name ?? 'Other'}
            </Text>
            <Text className="w-10 text-right font-inter text-[14px] leading-[18px] text-muted">
              {s.percent}%
            </Text>
            <Text className="w-24 text-right font-tight-bold text-body tabular-nums text-ink">
              {formatGhs(s.amount)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
