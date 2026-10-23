import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { formatPlain } from '@/domain/money';
import { Icon, Sheet, SheetTitle } from '@/ui';

import { MONTH_OPTIONS } from './months';
import { usePeriod } from './PeriodProvider';

export function MonthSheet() {
  const router = useRouter();
  const { month, selectMonth } = usePeriod();

  return (
    <Sheet testID="monthSheet">
      <SheetTitle title="Choose a month" body="Home and Insights show the month you pick." />
      <View>
        {[...MONTH_OPTIONS].reverse().map((option, index, all) => {
          const selected = option.id === month.id;
          return (
            <Pressable
              key={option.id}
              testID={`monthOption-${option.id}`}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => {
                selectMonth(option.id);
                router.back();
              }}
              className={`flex-row items-center gap-3 border-t border-hairline py-[14px] ${index === all.length - 1 ? 'border-b' : ''}`}
            >
              <View className="flex-1">
                <Text
                  className={`text-body ${selected ? 'font-inter-bold' : 'font-inter-medium'} text-ink`}
                >
                  {option.label}
                </Text>
                <Text className="font-inter text-caption text-muted">
                  Spent GHS {formatPlain(option.spent)}
                  {option.isCurrent ? ' so far' : ''}
                </Text>
              </View>
              {selected ? <Icon name="check" size={22} strokeWidth={2} /> : null}
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}
