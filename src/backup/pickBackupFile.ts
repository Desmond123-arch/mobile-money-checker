import { getDocumentAsync } from 'expo-document-picker';

// Returns a file:// URI of a copy in the app cache, or null when the user backs out.
// The caller owns the copy and deletes it through the source's dispose().
export async function pickBackupFile(): Promise<string | null> {
  const result = await getDocumentAsync({
    type: ['text/xml', 'application/xml'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return null;
  return result.assets[0]?.uri ?? null;
}
