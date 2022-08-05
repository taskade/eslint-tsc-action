import path from 'path';
import * as typescript from 'typescript';

import { Annotation } from './types';

export default async function tsc(
  filesToLint: Set<string>
): Promise<Annotation[]> {
  console.log('Running TSC...');

  const modulePath = path.join(process.cwd(), 'node_modules/typescript');
  const ts = (await import(modulePath)) as typeof typescript;

  const configFileName = ts.findConfigFile(process.cwd(), ts.sys.fileExists);

  if (configFileName == null) {
    throw new Error('config file not found!');
  }

  const configFile = ts.readConfigFile(configFileName, ts.sys.readFile);

  const compilerOptions = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    process.cwd()
  );

  const rootNames = [...filesToLint].map((file) => {
    return path.join(process.cwd(), file);
  });
  const annotations: Annotation[] = [];

  for (const fileName of rootNames) {
    const program = ts.createProgram({
      options: compilerOptions.options,
      rootNames: [fileName],
      configFileParsingDiagnostics: compilerOptions.errors,
    });
    const allDiagnostics = ts.getPreEmitDiagnostics(program);

    const formatHost: typescript.FormatDiagnosticsHost = {
      getCanonicalFileName(fileName: string) {
        return fileName;
      },
      getCurrentDirectory: ts.sys.getCurrentDirectory,
      getNewLine() {
        return ts.sys.newLine;
      },
    };

    for (const diagnostic of allDiagnostics) {
      if (diagnostic.file == null || diagnostic.start == null) {
        continue;
      }

      const filePath = path.relative(process.cwd(), diagnostic.file.fileName);

      if (!filesToLint.has(filePath)) {
        // Ignore files  that don't need annotations
        continue;
      }

      const lineAndChar = diagnostic.file.getLineAndCharacterOfPosition(
        diagnostic.start
      );

      const length = diagnostic.length ?? 0;

      const start_column = lineAndChar.character + 1;
      const end_column = lineAndChar.character + length;

      const start_line = lineAndChar.line + 1;
      const end_line = start_line;

      const annotation_level: Annotation['annotation_level'] = 'failure';

      const message = ts
        .formatDiagnostic(diagnostic, formatHost)
        /**
         * HACK: This removes most of the repeated file path in the formatted diagnostic message,
         * which is unnecessary as the annotation is already displayed over its corresponding file.
         */
        .replace(filePath, '');

      const title = `TypeScript Compiler: Code ${diagnostic.code}`;

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
  }

  return annotations;
}
