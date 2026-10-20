// Lets `node scripts/x.ts` import src/domain files that use extensionless relative imports (Metro and
// ts-jest style). Node's built-in type stripping needs real file names, so try `.ts` and `/index.ts`.
import { register } from 'node:module';

register('./resolve-ts.mjs', import.meta.url);
