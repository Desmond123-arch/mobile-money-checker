import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { dayState, monthGrid } from '@/domain/calendar/week';
import { Button, FilterPill, Icon, Sheet, SheetTitle } from '@/ui';

import { usePeriod } from './PeriodProvider';
import { useToday } from './useToday';

type Mode = 'day' | 'month' | 'year' | 'all';

const HEADINGS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function CalendarSheet() {
  const router = useRouter();
  const today = useToday();
  const { scope, month, months, years, selectDay, selectMonth, selectYear, selectAllTime } =
    usePeriod();
  const [mode, setMode] = useState<Mode>(scope.kind);
  const [shownId, setShownId] = useState(month.id);

  const shownIndex = Math.max(
    0,
    months.findIndex((m) => m.id === shownId),
  );
  const shown = months[shownIndex] ?? month;
  const [year = 2026, monthNumber = 1] = shown.id.split('-').map(Number);
  const rows = monthGrid(year, monthNumber - 1);

  const step = (delta: number) => {
    const next = months[shownIndex + delta];
    if (next) setShownId(next.id);
  };

  return (
    <Sheet testID="calendarSheet">
      <SheetTitle title="Pick a day, month or year" body="Insights show what you choose." />
      <View className="flex-row flex-wrap gap-2">
        <FilterPill
          testID="calendarModeDay"
          label="Day"
          active={mode === 'day'}
          onPress={() => setMode('day')}
        />
        <FilterPill
          testID="calendarModeMonth"
          label="Month"
          active={mode === 'month'}
          onPress={() => setMode('month')}
        />
        <FilterPill
          testID="calendarModeYear"
          label="Year"
          active={mode === 'year'}
          onPress={() => setMode('year')}
        />
        <FilterPill
          testID="calendarModeAll"
          label="All time"
          active={mode === 'all'}
          onPress={() => setMode('all')}
        />
      </View>

      {mode === 'day' ? (
        <View testID="calendarDays" className="gap-2">
          <View className="flex-row items-center justify-between pb-1">
            <Pressable
              testID="calendarPrev"
              accessibilityRole="button"
              accessibilityLabel="Previous month"
              disabled={shownIndex === 0}
              onPress={() => step(-1)}
              className={`size-11 items-center justify-center rounded-[22px] border-hard border-ink ${shownIndex === 0 ? 'opacity-30' : ''}`}
            >
              <Icon name="back" size={20} strokeWidth={2} />
            </Pressable>
            <Text className="font-tight-extrabold text-[20px] leading-[26px] text-ink">
              {shown.label}
            </Text>
            <Pressable
              testID="calendarNext"
              accessibilityRole="button"
              accessibilityLabel="Next month"
              disabled={shownIndex === months.length - 1}
              onPress={() => step(1)}
              className={`size-11 items-center justify-center rounded-[22px] border-hard border-ink ${shownIndex === months.length - 1 ? 'opacity-30' : ''}`}
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
                const selected = scope.kind === 'day' && scope.iso === cell.iso;
                const state = dayState(cell.iso, today);
                return (
                  <View key={cell.iso} className="h-11 flex-1 items-center justify-center">
                    <Pressable
                      testID={`calendarDay-${cell.iso}`}
                      accessibilityRole="button"
                      accessibilityLabel={cell.iso}
                      accessibilityState={{ selected }}
                      onPress={() => {
                        selectDay(cell.iso);
                        router.back();
                      }}
                      className={`size-10 items-center justify-center rounded-full ${selected ? 'bg-ink' : state === 'today' ? 'border-hard border-ink bg-signal' : ''}`}
                    >
                      <Text
                        className={`font-inter-semibold text-[15px] leading-5 ${selected ? 'text-ground' : state === 'future' ? 'text-muted/60' : 'text-ink'}`}
                      >
                        {cell.day}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ))}
          <Pressable
            testID="calendarWholeMonth"
            accessibilityRole="button"
            onPress={() => {
              selectMonth(shown.id);
              router.back();
            }}
            className="items-center pt-3"
          >
            <Text className="font-inter-semibold text-[15px] leading-5 text-ink underline">
              Show all of {shown.label}
            </Text>
          </Pressable>
        </View>
      ) : mode === 'year' ? (
        <View testID="calendarYears" className="flex-row flex-wrap gap-2">
          {years.length === 0 ? (
            <Text className="font-inter text-body leading-6 text-muted">
              No year has payments yet.
            </Text>
          ) : null}
          {years.map((year) => {
            const selected = scope.kind === 'year' && scope.year === year;
            return (
              <Pressable
                key={year}
                testID={`calendarYear-${year}`}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => {
                  selectYear(year);
                  router.back();
                }}
                className={`w-[31%] items-center rounded-chip border-hard border-ink py-4 ${selected ? 'bg-ink' : 'bg-ground'}`}
              >
                <Text
                  className={`font-tight-extrabold text-[18px] leading-6 ${selected ? 'text-ground' : 'text-ink'}`}
                >
                  {year}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : mode === 'all' ? (
        <View testID="calendarAll" className="gap-4">
          <Text className="font-inter text-body leading-6 text-muted">
            Everything since your first payment, in one view.
          </Text>
          <Button
            testID="calendarAllConfirm"
            label="Show all time"
            block
            disabled={years.length === 0}
            onPress={() => {
              selectAllTime();
              router.back();
            }}
          />
        </View>
      ) : (
        <View testID="calendarMonths" className="flex-row flex-wrap gap-2">
          {months.map((option) => {
            const selected = scope.kind === 'month' && scope.month.id === option.id;
            return (
              <Pressable
                key={option.id}
                testID={`calendarMonth-${option.id}`}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => {
                  selectMonth(option.id);
                  router.back();
                }}
                className={`w-[31%] items-center rounded-chip border-hard border-ink py-4 ${selected ? 'bg-ink' : 'bg-ground'}`}
              >
                <Text
                  className={`font-tight-extrabold text-[18px] leading-6 ${selected ? 'text-ground' : 'text-ink'}`}
                >
                  {option.short}
                </Text>
                <Text
                  className={`font-inter text-caption ${selected ? 'text-ground/70' : 'text-muted'}`}
                >
                  {option.label.slice(-4)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </Sheet>
  );
}
