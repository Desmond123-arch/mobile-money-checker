import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Text, View } from 'react-native';

import { useScan } from '@/features/app';
import { Button, FixedScreen, Hint, hardShadow } from '@/ui';

import { summaryLine } from './summaryLine';
import { useImportState } from './useImportState';

// Shown only when the screen is opened without an import or scan running (a deep link).
const SAMPLE = { read: 1284, total: 2488, payments: 612 };

export function ImportingScreen() {
  const router = useRouter();
  const state = useImportState();
  const scan = useScan();
  useEffect(() => {
    if (state.kind === 'scan' && state.phase === 'done' && state.empty) {
      router.replace('/no-messages');
    }
  }, [router, state.kind, state.phase, state.empty]);
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
          <View className="gap-3 pb-3">
            <Text testID="importFailedNote" className="font-inter text-caption text-warn">
              {state.kind === 'scan'
                ? 'We could not read your messages. Nothing was lost, and what we read is kept.'
                : 'We could not read that file. Go back and pick it again.'}
            </Text>
            {state.kind === 'scan' ? (
              <Button
                testID="importRetryBtn"
                label="Try again"
                variant="outline"
                size="md"
                onPress={() => void scan.afterGrant()}
              />
            ) : null}
          </View>
        ) : null}
        <Hint title="You can leave this screen">
          It keeps going in the background. We skip login codes and anything that isn’t from
          MobileMoney.
        </Hint>
      </View>
    </FixedScreen>
  );
}
