import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { formatPlain } from '@/domain/money';
import { FilterPill, Icon, Screen, ScreenTitle, TAB_BAR_CLEARANCE } from '@/ui';

import { TransactionRow } from './components/TransactionRow';
import { SAMPLE_DAYS } from './sample';

type Filter = 'all' | 'out' | 'in';

export function TransactionsScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');

  return (
    <Screen bottomPad={TAB_BAR_CLEARANCE}>
      <ScreenTitle
        title="Transactions"
        trailing={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Search"
            className="size-10 items-center justify-center rounded-[20px] bg-hairline"
          >
            <Icon name="search" size={20} strokeWidth={1.8} />
          </Pressable>
        }
      />
      <View className="flex-row items-center gap-2 px-5 pt-5">
        <FilterPill label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
        <FilterPill label="Out" active={filter === 'out'} onPress={() => setFilter('out')} />
        <FilterPill label="In" active={filter === 'in'} onPress={() => setFilter('in')} />
        <FilterPill label="Category" dropdown />
      </View>
      <View className="px-5 pt-2">
        {SAMPLE_DAYS.map((day) => {
          const rows = day.rows.filter((r) => filter === 'all' || r.direction === filter);
          if (rows.length === 0) return null;
          return (
            <View key={day.label}>
              <View className="flex-row items-baseline justify-between pb-1 pt-5">
                <Text className="font-inter-bold text-caption text-muted">{day.label}</Text>
                <Text className="font-inter-medium text-caption text-muted">
                  {day.total < 0 ? '−' : '+'}
                  {formatPlain(day.total)}
                </Text>
              </View>
              {rows.map((row) => (
                <TransactionRow
                  key={row.id}
                  row={row}
                  onPress={() => router.push(`/transaction/${row.id}`)}
                  onAddNote={() => router.push('/sheets/add-note')}
                />
              ))}
            </View>
          );
        })}
      </View>
    </Screen>
  );
}
