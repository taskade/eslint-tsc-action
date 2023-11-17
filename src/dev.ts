import path from 'path';

import eslint from './eslint';
import tsc from './tsc';
import { Annotation } from './types';

/**
 * This script is only used for development.
 *
 * Usage: In another Node.js TS Repo,
 * run `ts-node <path-to-this-file>`
 * with arguments of files to lint
 *
 * e.g. `ts-node /somewhere/dev.ts src/browser/main.ts`
 */
async function run() {
  const extensions = new Set(['.js', '.jsx', '.ts', '.tsx']);

  const filesInput = [...process.argv.slice(2)];

  const filesToLint = new Set<string>();

  for (const file of filesInput) {
    const fileExtension = path.extname(file);

    if (!extensions.has(fileExtension)) {
      continue;
    }

    filesToLint.add(file);
  }

  console.log(`Linting ${filesToLint.size} files`, [...filesToLint]);

  // Run ESLint and TSC

  const annotations: Annotation[] = [];

  annotations.push(...(await eslint(filesToLint)));
  console.log('Completed ESLint');
  annotations.push(...(await tsc(filesToLint)));
  console.log('Completed TSC');

  console.log(annotations);
}

run().catch((error) => {
  console.trace(error);
});
