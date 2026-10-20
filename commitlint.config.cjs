module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'refactor', 'perf', 'test', 'docs', 'build', 'ci', 'chore', 'revert'],
    ],
    'scope-enum': [
      2,
      'always',
      [
        'sms',
        'parser',
        'ledger',
        'db',
        'categorise',
        'ui',
        'home',
        'transactions',
        'insights',
        'settings',
        'app',
        'docs',
        'deps',
        'tooling',
      ],
    ],
    'header-max-length': [2, 'always', 72],
  },
};
