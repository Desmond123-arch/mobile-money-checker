import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { DashedChip, WordChip } from '@/ui';

interface NameListProps {
  idPrefix: string;
  initial: readonly string[];
  tint: string;
}

export function NameList({ idPrefix, initial, tint }: NameListProps) {
  const [names, setNames] = useState<readonly string[]>(initial);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  const commit = () => {
    const name = draft.trim().toLowerCase();
    if (name !== '' && !names.includes(name)) setNames([...names, name]);
    setDraft('');
    setAdding(false);
  };

  return (
    <View className="flex-row flex-wrap items-center gap-2">
      {names.map((n) => (
        <WordChip
          key={n}
          testID={`${idPrefix}Name-${n}`}
          label={n}
          tint={tint}
          onRemove={() => setNames(names.filter((x) => x !== n))}
        />
      ))}
      {adding ? (
        <TextInput
          testID={`${idPrefix}NameInput`}
          autoFocus
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={commit}
          onBlur={commit}
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
  );
}
