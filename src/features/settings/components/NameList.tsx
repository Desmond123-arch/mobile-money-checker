import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { useWrite } from '@/features/app';
import { addName, removeName, type NameKind } from '@/ledger/names';
import { DashedChip, WordChip } from '@/ui';

interface NameListProps {
  kind: NameKind;
  idPrefix: string;
  names: readonly string[];
  tint: string;
}

const LIST_LABEL: Record<NameKind, string> = { family: 'Family', friend: 'Friends' };

export function NameList({ kind, idPrefix, names, tint }: NameListProps) {
  const { run, error } = useWrite();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const commit = async () => {
    const text = draft;
    setDraft('');
    setAdding(false);
    setProblem(null);
    if (text.trim() === '') return;
    const saved = await run((db) => addName(db, kind, text), ['money', 'settings']);
    if (saved?.value.ok === false && saved.value.reason === 'otherList') {
      setProblem(
        `${text.trim()} is already in ${LIST_LABEL[saved.value.list]}. Remove it there first.`,
      );
    }
  };

  return (
    <View className="gap-2">
      <View className="flex-row flex-wrap items-center gap-2">
        {names.map((n) => (
          <WordChip
            key={n}
            testID={`${idPrefix}Name-${n}`}
            label={n}
            tint={tint}
            onRemove={() => void run((db) => removeName(db, kind, n), ['money', 'settings'])}
          />
        ))}
        {adding ? (
          <TextInput
            testID={`${idPrefix}NameInput`}
            autoFocus
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={() => void commit()}
            onBlur={() => void commit()}
            placeholder="Name"
            placeholderTextColor="#444444"
            returnKeyType="done"
            autoCapitalize="none"
            className="min-w-[110px] rounded-full border-hard border-dashed border-ink bg-ground px-[14px] py-[6px] font-inter-semibold text-[14px] text-ink"
          />
        ) : (
          <DashedChip
            testID={`${idPrefix}AddNameBtn`}
            label="Add name"
            icon
            onPress={() => setAdding(true)}
          />
        )}
      </View>
      {problem || error ? (
        <Text testID={`${idPrefix}NameError`} className="font-inter text-caption text-warn">
          {problem ?? error}
        </Text>
      ) : null}
    </View>
  );
}
