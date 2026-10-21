const expo = require('eslint-config-expo/flat');

// Only the scan reaches the inbox. Every no-restricted-imports block below repeats this pattern,
// because a later block replaces an earlier one for the files both match.
const NATIVE_SMS = {
  group: ['**/modules/momo-sms', '**/modules/momo-sms/*'],
  message: 'Only src/scan may import the native SMS module.',
};

module.exports = [
  ...expo,
  {
    // Agent worktrees hold full stale copies of other branches; linting them reports files that no longer exist here.
    ignores: [
      'node_modules/',
      'dist/',
      '.expo/',
      'android/',
      'ios/',
      'coverage/',
      '.claude/worktrees/',
    ],
  },
  {
    // The domain is pure: no React Native, no Expo, no SQLite. This is what keeps its tests fast and its logic portable.
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'react',
                'react-native',
                'react-native/*',
                'expo',
                'expo-*',
                '@/data/*',
                '@/ledger/*',
                '@/scan/*',
                '@/features/*',
                '@/ui/*',
              ],
              message: 'src/domain must stay pure (no RN, Expo, SQLite or app layers).',
            },
            NATIVE_SMS,
          ],
        },
      ],
      'no-console': 'error',
    },
  },
  {
    // Message bodies flow through here, so nothing may log; Expo stays behind two adapters.
    files: ['src/backup/**/*.ts'],
    ignores: ['src/backup/expoFileSource.ts', 'src/backup/pickBackupFile.ts'],
    rules: {
      'no-console': 'error',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-native', 'expo', 'expo-*'],
              message: 'Only expoFileSource.ts and pickBackupFile.ts may import Expo.',
            },
            NATIVE_SMS,
          ],
        },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}', 'scripts/**/*.ts'],
    ignores: ['src/scan/**', 'src/domain/**', 'src/backup/**'],
    rules: { 'no-restricted-imports': ['error', { patterns: [NATIVE_SMS] }] },
  },
  {
    files: ['src/ledger/**/*.ts', 'src/scan/**/*.ts'],
    rules: { 'no-console': 'error' },
  },
  {
    // Money is integer pesewas. Floating point parsing of amounts is banned in the domain.
    files: ['src/domain/**/*.ts'],
    ignores: ['**/__tests__/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'parseFloat',
          message: 'Do not parse money with floats. Use parseAmount (string -> integer pesewas).',
        },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Number', property: 'parseFloat', message: 'Do not parse money with floats.' },
      ],
    },
  },
];
