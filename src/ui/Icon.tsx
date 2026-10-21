import type { ReactNode } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

interface Glyph {
  viewBox: string;
  draw: (p: { stroke: string; width: number }) => ReactNode;
}

const line = (d: string, p: { stroke: string; width: number }) => (
  <Path
    d={d}
    fill="none"
    stroke={p.stroke}
    strokeWidth={p.width}
    strokeLinecap="round"
    strokeLinejoin="round"
  />
);

const GLYPHS = {
  home: {
    viewBox: '0 0 24 24',
    draw: (p) => line('M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z', p),
  },
  list: { viewBox: '0 0 24 24', draw: (p) => line('M5 7h14M5 12h14M5 17h9', p) },
  pie: {
    viewBox: '0 0 24 24',
    draw: (p) => (
      <>
        {line('M12 3a9 9 0 1 0 9 9h-9z', p)}
        {line('M15 3.5A9 9 0 0 1 20.5 9H15z', p)}
      </>
    ),
  },
  gear: {
    viewBox: '0 0 24 24',
    draw: (p) => (
      <>
        <Circle
          cx={12}
          cy={12}
          r={3}
          fill="none"
          stroke={p.stroke}
          strokeWidth={p.width}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {line(
          'M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1',
          p,
        )}
      </>
    ),
  },
  chevronDown: { viewBox: '0 0 16 16', draw: (p) => line('M4 6l4 4 4-4', p) },
  chevronRight: { viewBox: '0 0 16 16', draw: (p) => line('M6 4l4 4-4 4', p) },
  chevronRightLarge: { viewBox: '0 0 20 20', draw: (p) => line('M8 5l5 5-5 5', p) },
  chevronDownLarge: { viewBox: '0 0 20 20', draw: (p) => line('M5 8l5 5 5-5', p) },
  back: { viewBox: '0 0 20 20', draw: (p) => line('M12 4l-6 6 6 6', p) },
  filter: { viewBox: '0 0 20 20', draw: (p) => line('M3 5h14M6 10h8M8.5 15h3', p) },
  search: {
    viewBox: '0 0 20 20',
    draw: (p) => (
      <>
        <Circle
          cx={9}
          cy={9}
          r={5.5}
          fill="none"
          stroke={p.stroke}
          strokeWidth={p.width}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {line('M13.2 13.2L17 17', p)}
      </>
    ),
  },
  pencil: {
    viewBox: '0 0 22 22',
    draw: (p) => line('M4 16.5V18h1.5L16 7.5 14.5 6zM14.5 6l1.5-1.5L17.5 6 16 7.5', p),
  },
  plus: { viewBox: '0 0 24 24', draw: (p) => line('M12 6v12M6 12h12', p) },
  plusSmall: { viewBox: '0 0 14 14', draw: (p) => line('M7 3v8M3 7h8', p) },
  plusLarge: { viewBox: '0 0 20 20', draw: (p) => line('M10 4v12M4 10h12', p) },
  close: { viewBox: '0 0 14 14', draw: (p) => line('M4 4l6 6M10 4l-6 6', p) },
  check: { viewBox: '0 0 22 22', draw: (p) => line('M4 11.5l4.5 4.5L18 6', p) },
  arrowDown: { viewBox: '0 0 14 14', draw: (p) => line('M7 3v8M3.5 7.5L7 11l3.5-3.5', p) },
  arrowIn: { viewBox: '0 0 24 24', draw: (p) => line('M17 7L7 17M7 9v8h8', p) },
  exclaim: { viewBox: '0 0 24 24', draw: (p) => line('M12 8v5M12 16.5v.5', p) },
  fork: {
    viewBox: '0 0 24 24',
    draw: (p) => line('M8 4v6a2 2 0 0 0 4 0V4M10 4v16M17 4c-2 2-2.5 4.5-2.5 7H17v9', p),
  },
  car: {
    viewBox: '0 0 24 24',
    draw: (p) => line('M5 16l1.5-5h11L19 16M5 16h14M7.5 16v2M16.5 16v2', p),
  },
  people: {
    viewBox: '0 0 24 24',
    draw: (p) => (
      <>
        <Circle
          cx={9}
          cy={8}
          r={3}
          fill="none"
          stroke={p.stroke}
          strokeWidth={p.width}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Circle
          cx={17}
          cy={9.5}
          r={2.2}
          fill="none"
          stroke={p.stroke}
          strokeWidth={p.width}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {line('M3.5 19c.5-3 2.7-5 5.5-5s5 2 5.5 5M15.5 14.5c2.4 0 4 1.5 4.5 4', p)}
      </>
    ),
  },
  tag: { viewBox: '0 0 24 24', draw: (p) => line('M4 12V5a1 1 0 0 1 1-1h7l8 8-8 8z', p) },
  message: {
    viewBox: '0 0 48 48',
    draw: (p) => (
      <>
        {line(
          'M8 12h32a2 2 0 0 1 2 2v18a2 2 0 0 1-2 2H22l-8 7v-7H8a2 2 0 0 1-2-2V14a2 2 0 0 1 2-2z',
          p,
        )}
        {line('M15 21h18M15 27h10', p)}
      </>
    ),
  },
  messageOff: {
    viewBox: '0 0 48 48',
    draw: (p) => (
      <>
        {line(
          'M8 12h32a2 2 0 0 1 2 2v18a2 2 0 0 1-2 2H22l-8 7v-7H8a2 2 0 0 1-2-2V14a2 2 0 0 1 2-2z',
          p,
        )}
        {line('M12 40L38 8', p)}
      </>
    ),
  },
  lock: {
    viewBox: '0 0 48 48',
    draw: (p) => (
      <>
        {line('M10 22h28a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V24a2 2 0 0 1 2-2z', p)}
        {line('M15 22v-6a9 9 0 0 1 18 0v6', p)}
        {line('M24 30v5', p)}
      </>
    ),
  },
} satisfies Record<string, Glyph>;

export type IconName = keyof typeof GLYPHS;

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 24, color = '#14110F', strokeWidth = 1.9 }: IconProps) {
  const glyph: Glyph = GLYPHS[name];
  return (
    <Svg width={size} height={size} viewBox={glyph.viewBox}>
      {glyph.draw({ stroke: color, width: strokeWidth })}
    </Svg>
  );
}
