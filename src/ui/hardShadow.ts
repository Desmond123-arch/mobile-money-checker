import type { ViewStyle } from 'react-native';

export function hardShadow(color = '#14110F', offset = 4): ViewStyle {
  return { boxShadow: `${offset}px ${offset}px 0px ${color}` };
}
