import { useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { useWrite } from '@/features/app';
import { normaliseWord } from '@/domain/category/word';
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
  const { run, error } = useWrite({ overlap: true });
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  // Names being saved, shown at once so a slow save never looks like nothing happened.
  const [saving, setSaving] = useState<readonly string[]>([]);
  // Done and the blur that follows it both commit; whichever comes second finds this empty.
  const text = useRef('');

  const changeDraft = (next: string) => {
    text.current = next;
    setDraft(next);
  };

  const commit = async () => {
    const entered = text.current.trim();
    changeDraft('');
    setAdding(false);
    setProblem(null);
    if (entered === '') return;
    const shown = normaliseWord(entered);
    if (shown !== '' && !names.includes(shown)) setSaving((now) => [...now, shown]);
    const saved = await run(
      (db) => addName(db, kind, entered),
      (res) => (res.ok && res.changed > 0 ? ['money', 'settings'] : ['settings']),
    );
    setSaving((now) => now.filter((n) => n !== shown));
    if (saved?.value.ok === false && saved.value.reason === 'otherList') {
      setProblem(
        `${entered} is already in ${LIST_LABEL[saved.value.list]}. Remove it there first.`,
      );
    }
  };

  const shownNames = [...names, ...saving.filter((n) => !names.includes(n))];

  return (
    <View className="gap-2">
      <View className="flex-row flex-wrap items-center gap-2">
        {shownNames.map((n) => (
          <WordChip
            key={n}
            testID={`${idPrefix}Name-${n}`}
            label={n}
            tint={tint}
            onRemove={() =>
              void run(
                (db) => removeName(db, kind, n),
                (changed) => (changed > 0 ? ['money', 'settings'] : ['settings']),
              )
            }
          />
        ))}
        {adding ? (
          <TextInput
            testID={`${idPrefix}NameInput`}
            autoFocus
            value={draft}
            onChangeText={changeDraft}
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
