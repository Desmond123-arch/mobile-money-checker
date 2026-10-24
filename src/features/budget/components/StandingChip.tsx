import { Text, View } from 'react-native';

import type { Standing } from '@/domain/budget/standing';
import { Icon } from '@/ui';

import { standingChip } from '../labels';

/** Safe (ink) or Behind (red). The word and the check carry the meaning, not the colour. */
export function StandingChip({ standing, testID }: { standing: Standing; testID?: string }) {
  const safe = standing.status === 'safe';
  return (
    <View
      testID={testID}
      className={`shrink-0 flex-row items-center gap-1 rounded-full px-3 py-1 ${safe ? 'bg-ink' : 'bg-warn'}`}
    >
      {safe ? <Icon name="check" size={12} color="#FFFFFF" strokeWidth={2.4} /> : null}
      <Text className="font-inter-semibold text-caption text-ground">{standingChip(standing)}</Text>
    </View>
  );
}
