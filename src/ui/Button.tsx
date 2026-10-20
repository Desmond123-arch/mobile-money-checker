import { Pressable, Text } from 'react-native';

import { hardShadow } from './hardShadow';

type Variant = 'signal' | 'ink' | 'outline';

const SURFACE: Record<Variant, string> = {
  signal: 'bg-signal',
  ink: 'bg-ink',
  outline: 'bg-ground',
};

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: 'lg' | 'md';
  /** Fill the width (the default for sheet and screen actions). */
  block?: boolean;
}

export function Button({
  label,
  onPress,
  variant = 'signal',
  size = 'lg',
  block = true,
}: ButtonProps) {
  const pad = size === 'lg' ? 'p-4' : 'px-6 py-[14px]';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={`items-center justify-center rounded-[14px] border-hard border-ink ${SURFACE[variant]} ${pad} ${block ? '' : 'self-start'}`}
      style={hardShadow(variant === 'ink' ? '#F5B800' : '#14110F')}
    >
      <Text
        className={`font-tight-extrabold ${size === 'lg' ? 'text-[18px] leading-[22px]' : 'text-body'} ${variant === 'ink' ? 'text-ground' : 'text-ink'}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function TextLink({
  label,
  onPress,
  className = '',
}: {
  label: string;
  onPress?: () => void;
  className?: string;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={onPress}
      className="items-center justify-center p-[6px]"
    >
      <Text className={`font-inter-semibold text-[15px] text-ink underline ${className}`}>
        {label}
      </Text>
    </Pressable>
  );
}
