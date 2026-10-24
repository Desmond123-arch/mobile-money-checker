import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { pickBackupFile } from '@/backup/pickBackupFile';
import { startImport } from '@/backup/startImport';
import { createLedgerSink, useDb } from '@/features/app';
import { Button, Sheet, SheetTitle } from '@/ui';

const STEPS = [
  'Install SMS Backup & Restore from the Play Store.',
  'Back up your messages. Choose the MobileMoney conversation, or all messages.',
  'Save the XML file to this phone.',
  'Come back here and pick that file.',
];

export function ImportStepsSheet() {
  const router = useRouter();
  const db = useDb();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const choose = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const uri = await pickBackupFile();
      if (!uri) return;
      void startImport(uri, createLedgerSink(db));
      router.dismiss();
      router.replace('/importing');
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet testID="importStepsSheet">
      <SheetTitle
        title="Import a backup file"
        body="Use your own backup instead of giving this app access to your messages. The file is read once and only MobileMoney messages are kept."
      />
      <View className="gap-3">
        {STEPS.map((text, i) => (
          <View key={text} testID={`importStep-${i + 1}`} className="flex-row items-start gap-3">
            <View className="size-7 items-center justify-center rounded-full border-hard border-ink bg-signal">
              <Text className="font-tight-extrabold text-[14px] leading-[18px] text-ink">
                {i + 1}
              </Text>
            </View>
            <Text className="flex-1 font-inter text-[16px] leading-[24px] text-ink">{text}</Text>
          </View>
        ))}
      </View>
      {failed ? (
        <Text testID="importPickError" className="font-inter text-[14px] leading-[19px] text-warn">
          Could not open that file. Try picking it again.
        </Text>
      ) : null}
      <Button
        testID="chooseFileBtn"
        label="Choose file"
        variant="ink"
        disabled={busy}
        onPress={() => void choose()}
      />
    </Sheet>
  );
}
