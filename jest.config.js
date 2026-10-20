/** Domain, data and ledger tests run in plain Node. UI tests (later) get their own project. */
module.exports = {
  collectCoverageFrom: ['src/domain/**/*.ts', '!**/__tests__/**'],
  coverageReporters: ['text-summary', 'text', 'lcov'],
  // The domain carries the correctness burden (money, parsing, merging), so it is held to a high bar.
  coverageThreshold: {
    './src/domain/': { statements: 95, branches: 90, functions: 95, lines: 95 },
  },
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'commonjs',
          target: 'es2022',
          strict: true,
          noUncheckedIndexedAccess: true,
          esModuleInterop: true,
          skipLibCheck: true,
          paths: { '@/*': ['./src/*'] },
          baseUrl: '.',
        },
        diagnostics: true,
      },
    ],
  },
};
