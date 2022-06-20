import path from 'path';
import * as typescript from 'typescript';

import { Annotation } from './types';

export default async function tsc(): Promise<Annotation[]> {
  console.log('Running TSC...');

  const modulePath = path.join(process.cwd(), 'node_modules/typescript');
  const ts = (await import(modulePath)) as typeof typescript;

  const configFileName = ts.findConfigFile(process.cwd(), ts.sys.fileExists);

  if (configFileName == null) {
    throw new Error('config file not found!');
  }

  const program = ts.createProgram(['**/**.ts'], {
    options: {},
    rootNames: [],
  });

  const allDiagnostics = ts.getPreEmitDiagnostics(program);

  const annotations: Annotation[] = [];

  for (const diagnostic of allDiagnostics) {
    if (diagnostic.file == null || diagnostic.start == null) {
      continue;
    }

    const filePath = path.join(process.cwd(), diagnostic.file.fileName);
    const lineAndChar = diagnostic.file.getLineAndCharacterOfPosition(
      diagnostic.start
    );

    const length = diagnostic.length ?? 0;

    const start_column = lineAndChar.character + 1;
    const end_column = lineAndChar.character + length;

    const start_line = lineAndChar.line + 1;
    const end_line = start_line;

    const annotation_level: Annotation['annotation_level'] = 'failure';

    const message = diagnostic.messageText as string;
    const title = `TS${diagnostic.code}`;

    const annotation: Annotation = {
      path: filePath,
      start_line,
      end_line,
      start_column,
      end_column,
      annotation_level,
      title,
      message,
    };

    annotations.push(annotation);
  }

  return annotations;
}