import { useSyncExternalStore } from 'react';

import { getImportState, subscribeImportState } from '@/backup/importStore';

export const useImportState = () =>
  useSyncExternalStore(subscribeImportState, getImportState, getImportState);
