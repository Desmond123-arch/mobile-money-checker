import type { ViewStyle } from 'react-native';

/** The neobrutalist offset shadow (design.md 4.1): action elements only. */
export function hardShadow(color = '#14110F', offset = 4): ViewStyle {
  return { boxShadow: `${offset}px ${offset}px 0px ${color}` };
}
