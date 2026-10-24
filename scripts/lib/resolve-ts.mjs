const SRC = new URL('../../src/', import.meta.url);

export async function resolve(specifier, context, nextResolve) {
  // The app's `@/` alias points at src/, as in tsconfig and jest.
  if (specifier.startsWith('@/')) {
    specifier = new URL(specifier.slice(2), SRC).href;
  }
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    const local = specifier.startsWith('.') || specifier.startsWith('file:');
    if (!local || !['ERR_MODULE_NOT_FOUND', 'ERR_UNSUPPORTED_DIR_IMPORT'].includes(error?.code))
      throw error;
    for (const suffix of ['.ts', '/index.ts']) {
      try {
        return await nextResolve(specifier + suffix, context);
      } catch {
        // try the next suffix
      }
    }
    throw error;
  }
}
