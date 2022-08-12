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
  const filesToLint = new Set([...process.argv.slice(2)]);

  console.log(`Linting ${filesToLint.size} files`, [...filesToLint]);

  // Run ESLint and TSC

  const annotations: Annotation[] = [];

  annotations.push(...(await eslint(filesToLint)));
  console.log('Completed ESLint');
  annotations.push(...(await tsc(filesToLint)));
  console.log('Completed TSC');

  console.log(
    annotations.map((annotation) => {
      return {
        message: annotation.message,
        path: annotation.path,
        title: annotation.title,
      };
    })
  );
}

run().catch((error) => {
  console.trace(error);
});
