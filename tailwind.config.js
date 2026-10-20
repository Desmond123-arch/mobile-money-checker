/** Design tokens come from docs/design.md ("signage": ink on white with one yellow). */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        ground: '#FFFFFF',
        ink: '#14110F',
        muted: '#444444',
        hairline: '#EEEEEE',
        signal: '#F5B800', // the one accent: a fill or underline, never text on white
        income: '#1F7A4D',
        warn: '#B3261E',
      },
      borderRadius: {
        chip: '12px',
        sheet: '28px',
      },
      borderWidth: {
        hard: '2px', // neobrutalist accents on action elements only (design.md 4.1)
      },
    },
  },
  plugins: [],
};
