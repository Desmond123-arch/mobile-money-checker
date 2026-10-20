describe('domain test setup', () => {
  it('runs in plain Node, without React Native or Expo', () => {
    expect(typeof process.versions.node).toBe('string');
    expect(typeof (globalThis as { __DEV__?: unknown }).__DEV__).toBe('undefined');
  });
});
