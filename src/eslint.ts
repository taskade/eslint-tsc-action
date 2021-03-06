import path from 'path';

import { Annotation } from './types';

const ESLINT_GITHUB_LEVELS: Annotation['annotation_level'][] = [
  'notice',
  'warning',
  'failure',
];

export default async function eslint(
  filesToLint: Set<string>
): Promise<Annotation[]> {
  console.log('Running ESLint...');

  const modulePath = path.join(process.cwd(), 'node_modules/eslint');
  const { ESLint } = (await import(modulePath)) as typeof import('eslint');

  const eslint = new ESLint();
  const results = await eslint.lintFiles([...filesToLint]);

  const annotations: Annotation[] = [];

  for (const result of results) {
    const { filePath, messages } = result;

    for (const msg of messages) {
      const { line, endLine, severity, ruleId, message, column, endColumn } =
        msg;

      const filePathRelative = path.relative(process.cwd(), filePath);
      const start_line = line || 0;
      const end_line = endLine || line || 0;
      const annotation_level = ESLINT_GITHUB_LEVELS[severity];
      const title = ruleId ? `ESLint: ${ruleId}` : 'ESLint';

      const annotation: Annotation = {
        path: filePathRelative,
        start_line,
        end_line,
        annotation_level,
        title,
        message,
      };

      if (annotation.start_line === annotation.end_line) {
        annotation.start_column = column || 0;
        annotation.end_column = endColumn || column || 0;
      }

      annotations.push(annotation);
    }
  }

  return annotations;
}
