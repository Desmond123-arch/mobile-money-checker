import { Pressable, Text, View } from 'react-native';

import { Icon } from './Icon';

interface CategoryChipProps {
  label: string;
  color: string;
  selected?: boolean;
  onPress?: () => void;
  /** `lg` is the sheet size, `md` the inline size. */
  size?: 'lg' | 'md';
  testID?: string;
}

/** A category picker chip: 2px ink border, no shadow (design.md 4.1). */
export function CategoryChip({
  label,
  color,
  selected = false,
  onPress,
  size = 'md',
  testID,
}: CategoryChipProps) {
  const pad = size === 'lg' ? 'py-[10px]' : 'py-[9px]';
  const text = size === 'lg' ? 'text-[15px]' : 'text-[14px]';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`flex-row items-center gap-2 rounded-full border-hard border-ink px-[14px] ${pad} ${selected ? 'bg-ink' : 'bg-ground'}`}
    >
      <View className="size-[10px] rounded-[3px]" style={{ backgroundColor: color }} />
      <Text
        className={`${text} leading-[18px] ${selected ? 'font-inter-semibold text-ground' : 'font-inter-medium text-ink'}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** A removable word or name, tinted by the category it belongs to. */
export function WordChip({
  label,
  tint,
  onRemove,
  testID,
}: {
  label: string;
  tint: string;
  onRemove?: () => void;
  testID?: string;
}) {
  return (
    <View
      testID={testID}
      className="flex-row items-center gap-[6px] rounded-full border-hard border-ink py-2 pl-[14px] pr-2"
      style={{ backgroundColor: tint }}
    >
      <Text className="font-inter-semibold text-[14px] leading-[18px] text-ink">{label}</Text>
      <Pressable
        testID={testID ? `${testID}Remove` : undefined}
        accessibilityLabel={`Remove ${label}`}
        onPress={onRemove}
        hitSlop={8}
      >
        <Icon name="close" size={14} strokeWidth={2} />
      </Pressable>
    </View>
  );
}

/** Dashed chip: "add", "more", "show all". */
export function DashedChip({
  label,
  icon = false,
  onPress,
  testID,
}: {
  label: string;
  icon?: boolean;
  onPress?: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      className="flex-row items-center gap-[6px] rounded-full border-hard border-dashed border-ink bg-ground px-[14px] py-2"
    >
      {icon ? <Icon name="plusSmall" size={14} strokeWidth={2.2} /> : null}
      <Text className="font-inter-semibold text-[14px] leading-[18px] text-ink">{label}</Text>
    </Pressable>
  );
}

/** A solid outlined suggestion with a leading plus. */
export function SuggestionChip({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress?: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      className="flex-row items-center gap-[6px] rounded-full border-hard border-ink bg-ground py-2 pl-[10px] pr-[14px]"
    >
      <Icon name="plusSmall" size={14} strokeWidth={2.2} />
      <Text className="font-inter-medium text-[14px] leading-[18px] text-ink">{label}</Text>
    </Pressable>
  );
}

/** Pill filter used on the Transactions screen. */
export function FilterPill({
  label,
  active = false,
  dropdown = false,
  onPress,
  testID,
}: {
  label: string;
  active?: boolean;
  dropdown?: boolean;
  onPress?: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      className={`flex-row items-center gap-1 rounded-full py-2 ${dropdown ? 'pl-4 pr-3' : 'px-4'} ${active ? 'bg-ink' : 'bg-hairline'}`}
    >
      <Text
        className={`text-[14px] leading-[18px] ${active ? 'font-inter-semibold text-ground' : 'font-inter-medium text-ink'}`}
      >
        {label}
      </Text>
      {dropdown ? <Icon name="chevronDown" size={16} strokeWidth={1.75} /> : null}
    </Pressable>
  );
}
