import { Text, View } from 'react-native';

import { FixedScreen, Hint, hardShadow } from '@/ui';

import { useImportState } from './useImportState';

// Shown only when the screen is opened without an import (deep link, or "Allow SMS access",
// which has no scan behind it yet).
const SAMPLE = { read: 1284, total: 2488, payments: 612 };

export function ImportingScreen() {
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
                {state.ingestIsStub
                  ? 'Payments are not counted yet'
                  : `${progress.payments} payments found`}
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
