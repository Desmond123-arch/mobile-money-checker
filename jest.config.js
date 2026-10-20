/** Domain, data and ledger tests run in plain Node. UI tests (later) get their own project. */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: { module: 'commonjs', target: 'es2022', strict: true, noUncheckedIndexedAccess: true, esModuleInterop: true, skipLibCheck: true, paths: { '@/*': ['./src/*'] }, baseUrl: '.' }, diagnostics: true }],
  },
};
