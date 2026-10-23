import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { formatPlain, pesewas } from '@/domain/money';
import { categoryById } from '@/features/categories';
import { useExpenses } from '@/features/expenses';
import {
  ClearButton,
  FilterPill,
  Icon,
  Screen,
  ScreenTitle,
  TAB_BAR_CLEARANCE,
  TextField,
} from '@/ui';

import { TransactionRow } from './components/TransactionRow';
import { useTransactionFilter } from './filterContext';
import { daysWithAdded } from './days';

type Direction = 'all' | 'out' | 'in';

export function TransactionsScreen() {
  const router = useRouter();
  const { categoryId, setCategoryId } = useTransactionFilter();
  const { added } = useExpenses();
  const [direction, setDirection] = useState<Direction>('all');
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');

  const needle = query.trim().toLowerCase();
  const category = categoryById(categoryId);

  const days = daysWithAdded(added)
    .map((day) => ({
      ...day,
      rows: day.rows.filter((r) => {
        if (direction !== 'all' && r.direction !== direction) return false;
        if (categoryId !== null && r.categoryId !== categoryId) return false;
        if (needle === '') return true;
        const haystack = `${r.counterparty} ${r.note ?? ''} ${categoryById(r.categoryId)?.name ?? ''}`;
        return haystack.toLowerCase().includes(needle);
      }),
    }))
    .filter((day) => day.rows.length > 0);

  const toggleSearch = () => {
    if (searching) setQuery('');
    setSearching(!searching);
  };

  return (
    <Screen testID="transactionsScreen" bottomPad={TAB_BAR_CLEARANCE}>
      <ScreenTitle
        title="Transactions"
        trailing={
          <View className="flex-row items-center gap-2">
            <Pressable
              testID="addExpenseBtn"
              accessibilityRole="button"
              accessibilityLabel="Add an expense"
              onPress={() => router.push('/sheets/add-expense')}
              className="size-10 items-center justify-center rounded-[20px] bg-signal"
            >
              <Icon name="plusLarge" size={20} strokeWidth={2.2} />
            </Pressable>
            <Pressable
              testID="transactionsSearchBtn"
              accessibilityRole="button"
              accessibilityLabel={searching ? 'Close search' : 'Search'}
              onPress={toggleSearch}
              className={`size-10 items-center justify-center rounded-[20px] ${searching ? 'bg-ink' : 'bg-hairline'}`}
            >
              <Icon
                name={searching ? 'close' : 'search'}
                size={20}
                color={searching ? '#FFFFFF' : '#14110F'}
                strokeWidth={1.8}
              />
            </Pressable>
          </View>
        }
      />
      {searching ? (
        <View className="px-5 pt-4">
          <TextField
            testID="transactionsSearchInput"
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name, note or category"
            returnKeyType="search"
          />
        </View>
      ) : null}
      <View className="flex-row items-center gap-2 px-5 pt-5">
        <FilterPill
          testID="transactionsFilterAll"
          label="All"
          active={direction === 'all'}
          onPress={() => setDirection('all')}
        />
        <FilterPill
          testID="transactionsFilterOut"
          label="Out"
          active={direction === 'out'}
          onPress={() => setDirection('out')}
        />
        <FilterPill
          testID="transactionsFilterIn"
          label="In"
          active={direction === 'in'}
          onPress={() => setDirection('in')}
        />
        <FilterPill
          testID="transactionsFilterCategory"
          label={category?.name ?? 'Category'}
          active={category !== null}
          dropdown
          onPress={() => router.push('/sheets/category-filter')}
        />
      </View>
      {category !== null ? (
        <View className="flex-row items-center gap-3 px-5 pt-3">
          <Text className="font-inter text-[14px] leading-[19px] text-muted">
            Showing {category.name} only
          </Text>
          <ClearButton testID="transactionsClearCategory" onPress={() => setCategoryId(null)} />
        </View>
      ) : null}
      <View className="px-5 pt-2">
        {days.map((day) => {
          const total = pesewas(
            day.rows.reduce((sum, r) => sum + (r.direction === 'in' ? r.amount : -r.amount), 0),
          );
          return (
            <View key={day.label}>
              <View className="flex-row items-baseline justify-between pb-1 pt-5">
                <Text className="font-inter-bold text-caption text-muted">{day.label}</Text>
                <Text className="font-inter-medium text-caption text-muted">
                  {total < 0 ? '−' : '+'}
                  {formatPlain(total)}
                </Text>
              </View>
              {day.rows.map((row) => (
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
        {days.length === 0 ? (
          <View testID="transactionsEmpty" className="items-start gap-2 pt-10">
            <Text className="font-tight-extrabold text-[22px] leading-[29px] text-ink">
              No payments match.
            </Text>
            <Text className="font-inter text-body leading-6 text-muted">
              Try a different word, or clear the filters.
            </Text>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
