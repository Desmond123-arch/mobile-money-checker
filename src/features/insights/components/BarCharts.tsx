import { Text, View } from 'react-native';

interface MonthBar {
  label: string;
  out: number;
  in: number;
}

const MONTH_MAX_HEIGHT = 114;

export function Legend({ items }: { items: readonly { label: string; color: string }[] }) {
  return (
    <View className="flex-row items-center gap-4 pt-3">
      {items.map((item) => (
        <View key={item.label} className="flex-row items-center gap-[6px]">
          <View className="size-[10px] rounded-[2px]" style={{ backgroundColor: item.color }} />
          <Text className="font-inter text-caption text-ink">{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Bars per label. `compact` fits twelve or more on a phone: each slot shares the width and only
 * money out is drawn.
 */
export function MonthlyChart({
  months,
  compact = false,
}: {
  months: readonly MonthBar[];
  compact?: boolean;
}) {
  // A run of empty months has max 0; dividing by 1 keeps every bar at its minimum height.
  const max = Math.max(1, ...months.flatMap((m) => (compact ? [m.out] : [m.out, m.in])));
  const peak = Math.max(...months.map((m) => m.out));
  const h = (v: number) => Math.max(4, Math.round((v / max) * MONTH_MAX_HEIGHT));
  const slot = compact ? 'flex-1' : 'w-12';
  return (
    <View>
      <View className="mt-3 h-[148px] flex-row items-end justify-between">
        {months.map((m) => {
          const isPeak = peak > 0 && m.out === peak;
          return (
            <View
              key={m.label}
              testID={`monthBar-${m.label}`}
              className={`h-[148px] ${slot} items-center justify-end gap-[6px]`}
            >
              {isPeak ? (
                <Text
                  numberOfLines={1}
                  className="min-w-16 text-center font-tight-bold text-caption text-ink"
                >
                  {m.out.toLocaleString('en-GH')}
                </Text>
              ) : null}
              <View className="flex-row items-end gap-[3px]">
                <View
                  className={`${compact ? 'w-4' : 'w-5'} rounded-b-[2px] rounded-t-[5px] ${isPeak ? 'border-hard border-ink bg-signal' : 'bg-ink'}`}
                  style={{ height: m.out === 0 && compact ? 2 : h(m.out) }}
                />
                {compact ? null : (
                  <View
                    className="w-5 rounded-b-[2px] rounded-t-[5px] bg-[#CFCFCF]"
                    style={{ height: h(m.in) }}
                  />
                )}
              </View>
            </View>
          );
        })}
      </View>
      <View className="flex-row justify-between border-t border-hairline pt-2">
        {months.map((m) => (
          <Text
            key={m.label}
            className={`${slot} text-center text-caption ${peak > 0 && m.out === peak ? 'font-inter-bold text-ink' : 'font-inter text-muted'}`}
          >
            {m.label}
          </Text>
        ))}
      </View>
    </View>
  );
}
