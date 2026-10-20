import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { formatGhs, pesewas } from '@/domain/money';
import type { ImportSummary } from '@/ledger/importSummary';
import { Button, FixedScreen, Hint, hardShadow } from '@/ui';

import { useImportState } from './useImportState';

// Shown only when the screen is opened without an import (deep link, or "Allow SMS access",
// which has no scan behind it yet).
const SAMPLE = { read: 1284, total: 2488, payments: 612 };

const monthLabel = (month: string) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

export function summaryLine(s: ImportSummary): string {
  const counts = `${s.transactions.toLocaleString('en-GH')} transactions, ${s.payments.toLocaleString('en-GH')} payments.`;
  if (s.latestMonth === null) return counts;
  return `${counts} Spent in ${monthLabel(s.latestMonth)}: ${formatGhs(pesewas(s.monthSpendPesewas))}.`;
}

export function ImportingScreen() {
  const router = useRouter();
  const state = useImportState();
  const isSample = state.phase === 'idle';
  const progress = isSample ? SAMPLE : state;
  const percent = progress.total > 0 ? Math.round((progress.read * 100) / progress.total) : 0;
  return (
    <FixedScreen testID="importingScreen">
      <View className="flex-1 px-5 pb-1 pt-6">
        <View className="flex-1 justify-center gap-4">
          <Text className="font-tight-extrabold text-[44px] leading-[58px] tracking-[-0.03em] text-ink">
            Reading your messages.
          </Text>
          <Text className="font-inter text-[17px] leading-[26px] text-muted">
            This only happens once. After this, new payments appear when you open the app.
          </Text>
          <View className="gap-[14px] pt-6">
            <View className="flex-row items-baseline gap-2">
              <Text className="font-tight-extrabold text-[54px] tabular-nums leading-[71px] tracking-[-0.03em] text-ink">
                {progress.read.toLocaleString('en-GH')}
              </Text>
              <Text className="font-inter text-body leading-[21px] text-muted">
                of {progress.total.toLocaleString('en-GH')}
              </Text>
            </View>
            <View
              testID="importProgressBar"
              className="h-6 flex-row overflow-hidden rounded-chip border-hard border-ink bg-ground"
              style={hardShadow()}
            >
              <View
                className="border-r-hard border-ink bg-signal"
                style={{ width: `${percent}%` }}
              />
            </View>
            <View className="flex-row justify-between pt-[6px]">
              <Text className="font-inter text-[14px] leading-[19px] text-ink">
                {`${progress.payments} payments found`}
              </Text>
              <Text className="font-inter text-[14px] leading-[19px] text-muted">{percent}%</Text>
            </View>
          </View>
        </View>
        {isSample ? (
          <Text testID="importSampleNote" className="pb-3 font-inter text-caption text-muted">
            Sample numbers. No import is running.
          </Text>
        ) : null}
        {state.phase === 'done' && state.summary ? (
          <View className="gap-4 pb-4">
            <Text
              testID="importCompleteTitle"
              className="font-tight-extrabold text-[24px] text-ink"
            >
              Import complete
            </Text>
            <Text testID="importSummary" className="font-inter text-[16px] leading-[24px] text-ink">
              {summaryLine(state.summary)}
            </Text>
            <Button
              testID="importHomeBtn"
              label="Go to Home"
              variant="ink"
              onPress={() => router.replace('/')}
            />
          </View>
        ) : null}
        {state.phase === 'failed' ? (
          <Text testID="importFailedNote" className="pb-3 font-inter text-caption text-warn">
            We could not read that file. Go back and pick it again.
          </Text>
        ) : null}
        <Hint title="You can leave this screen">
          It keeps going in the background. We skip login codes and anything that isn’t from
          MobileMoney.
        </Hint>
      </View>
    </FixedScreen>
  );
}
