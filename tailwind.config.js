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
        signal: '#F5B800',
        income: '#1F7A4D',
        warn: '#B3261E',
      },
      fontFamily: {
        // Expo loads each weight as its own family, so weights are picked by class, not by font-weight.
        inter: ['Inter_400Regular'],
        'inter-medium': ['Inter_500Medium'],
        'inter-semibold': ['Inter_600SemiBold'],
        'inter-bold': ['Inter_700Bold'],
        'tight-medium': ['InterTight_500Medium'],
        'tight-semibold': ['InterTight_600SemiBold'],
        'tight-bold': ['InterTight_700Bold'],
        'tight-extrabold': ['InterTight_800ExtraBold'],
      },
      fontSize: {
        caption: ['13px', { lineHeight: '16px' }],
        body: ['16px', { lineHeight: '20px' }],
        section: ['20px', { lineHeight: '24px' }],
        title: ['24px', { lineHeight: '30px' }],
      },
      borderRadius: {
        chip: '12px',
        sheet: '28px',
      },
      borderWidth: {
        hard: '2px',
      },
    },
  },
  plugins: [],
};
