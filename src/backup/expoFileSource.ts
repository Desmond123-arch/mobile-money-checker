import { File, FileMode } from 'expo-file-system';

import type { DisposableSource } from './readBackup';

export function openExpoFile(uri: string): DisposableSource {
  const file = new File(uri);
  const handle = file.open(FileMode.ReadOnly);
  return {
    size: file.size,
    // The handle keeps its own offset, and callers await each read, so seeking per call is safe.
    read: async (offset, length) => {
      handle.offset = offset;
      return handle.readBytes(length);
    },
    dispose: () => {
      handle.close();
      if (file.exists) file.delete();
    },
  };
}
