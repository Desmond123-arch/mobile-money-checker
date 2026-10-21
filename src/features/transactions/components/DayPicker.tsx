import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { monthGrid } from '@/domain/calendar/week';
import { Icon } from '@/ui';

const HEADINGS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

interface Props {
  /** `YYYY-MM-DD`, the day shown selected. */
  value: string;
  /** First and last day that can be picked, `YYYY-MM-DD`. */
  min: string;
  max: string;
  onPick: (iso: string) => void;
}

const monthKey = (iso: string) => iso.slice(0, 7);

/** A month grid for choosing one day between `min` and `max`. Days outside are greyed and do nothing. */
export function DayPicker({ value, min, max, onPick }: Props) {
  const [shown, setShown] = useState(monthKey(value));
  const [year = 2026, month = 1] = shown.split('-').map(Number);
  const rows = monthGrid(year, month - 1);

  const step = (delta: number) => {
    const next = new Date(Date.UTC(year, month - 1 + delta, 1));
    setShown(next.toISOString().slice(0, 7));
  };
  const canBack = shown > monthKey(min);
  const canForward = shown < monthKey(max);

  return (
    <View testID="cashAllocDayPicker" className="gap-2">
      <View className="flex-row items-center justify-between pb-1">
        <Pressable
          testID="cashAllocDayPrev"
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          disabled={!canBack}
          onPress={() => step(-1)}
          className={`size-11 items-center justify-center rounded-[22px] border-hard border-ink ${canBack ? '' : 'opacity-30'}`}
        >
          <Icon name="back" size={20} strokeWidth={2} />
        </Pressable>
        <Text className="font-tight-extrabold text-[20px] leading-[26px] text-ink">
          {NAMES[month - 1]} {year}
        </Text>
        <Pressable
          testID="cashAllocDayNext"
          accessibilityRole="button"
          accessibilityLabel="Next month"
          disabled={!canForward}
          onPress={() => step(1)}
          className={`size-11 items-center justify-center rounded-[22px] border-hard border-ink ${canForward ? '' : 'opacity-30'}`}
        >
          <View style={{ transform: [{ rotate: '180deg' }] }}>
            <Icon name="back" size={20} strokeWidth={2} />
          </View>
        </Pressable>
      </View>
      <View className="flex-row">
        {HEADINGS.map((h, i) => (
          <Text
            key={`${h}-${i}`}
            className="flex-1 pb-1 text-center font-inter-bold text-caption text-muted"
          >
            {h}
          </Text>
        ))}
      </View>
      {rows.map((row, r) => (
        <View key={`row-${r}`} className="flex-row">
          {row.map((cell, c) => {
            if (cell === null) return <View key={`gap-${r}-${c}`} className="h-11 flex-1" />;
            const allowed = cell.iso >= min && cell.iso <= max;
            const selected = cell.iso === value;
            return (
              <View key={cell.iso} className="h-11 flex-1 items-center justify-center">
                <Pressable
                  testID={`cashAllocDay-${cell.iso}`}
                  accessibilityRole="button"
                  accessibilityLabel={cell.iso}
                  accessibilityState={{ selected, disabled: !allowed }}
                  disabled={!allowed}
                  onPress={() => onPick(cell.iso)}
                  className={`size-10 items-center justify-center rounded-full ${selected ? 'bg-ink' : ''}`}
                >
                  <Text
                    className={`font-inter-semibold text-[15px] leading-5 ${selected ? 'text-ground' : allowed ? 'text-ink' : 'text-muted/60'}`}
                  >
                    {cell.day}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}
