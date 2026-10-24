import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { bottomInset } from './insets';

export function useBottomInset(): number {
  return bottomInset(useSafeAreaInsets().bottom);
}
