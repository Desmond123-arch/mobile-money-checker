import { Text, View } from 'react-native';

interface WeekdayBar {
  label: string;
  cedis: number;
}

interface MonthBar {
  label: string;
  out: number;
  in: number;
}

const WEEKDAY_MAX_HEIGHT = 92;
const MONTH_MAX_HEIGHT = 114;

/** The tallest bar is ink and carries its value; the rest are grey. */
export function WeekdayChart({ days }: { days: readonly WeekdayBar[] }) {
  const max = Math.max(...days.map((d) => d.cedis));
  return (
    <View>
      <View className="mt-5 h-32 flex-row items-end justify-between">
        {days.map((d) => {
          const peak = d.cedis === max;
          return (
            <View key={d.label} className="h-32 w-10 items-center justify-end gap-[6px]">
              {peak ? (
                <Text
                  numberOfLines={1}
                  className="min-w-16 text-center font-tight-bold text-caption text-ink"
                >
                  GHS {d.cedis}
                </Text>
              ) : null}
              <View
                className={`w-10 rounded-b-[3px] rounded-t-[8px] ${peak ? 'bg-ink' : 'bg-[#DADADA]'}`}
                style={{ height: Math.max(4, Math.round((d.cedis / max) * WEEKDAY_MAX_HEIGHT)) }}
              />
            </View>
          );
        })}
      </View>
      <View className="flex-row justify-between border-t border-hairline pt-2">
        {days.map((d) => (
          <Text
            key={d.label}
            className={`w-10 text-center text-caption ${d.cedis === max ? 'font-inter-bold text-ink' : 'font-inter text-muted'}`}
          >
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

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

/** Paired out/in columns per month; the biggest month is highlighted yellow with an ink outline. */
export function MonthlyChart({ months }: { months: readonly MonthBar[] }) {
  const max = Math.max(...months.flatMap((m) => [m.out, m.in]));
  const peak = Math.max(...months.map((m) => m.out));
  const h = (v: number) => Math.max(4, Math.round((v / max) * MONTH_MAX_HEIGHT));
  return (
    <View>
      <View className="mt-3 h-[148px] flex-row items-end justify-between">
        {months.map((m) => {
          const isPeak = m.out === peak;
          return (
            <View key={m.label} className="h-[148px] w-12 items-center justify-end gap-[6px]">
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
                  className={`w-5 rounded-b-[2px] rounded-t-[5px] ${isPeak ? 'border-hard border-ink bg-signal' : 'bg-ink'}`}
                  style={{ height: h(m.out) }}
                />
                <View
                  className="w-5 rounded-b-[2px] rounded-t-[5px] bg-[#CFCFCF]"
                  style={{ height: h(m.in) }}
                />
              </View>
            </View>
          );
        })}
      </View>
      <View className="flex-row justify-between border-t border-hairline pt-2">
        {months.map((m) => (
          <Text
            key={m.label}
            className={`w-12 text-center text-caption ${m.out === peak ? 'font-inter-bold text-ink' : 'font-inter text-muted'}`}
          >
            {m.label}
          </Text>
        ))}
      </View>
    </View>
  );
}
