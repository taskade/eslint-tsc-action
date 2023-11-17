import path from 'path';
import { Project } from 'ts-morph';
import * as typescript from 'typescript';

import { Annotation } from './types';

export default async function tsc(
  filesToLint: Set<string>
): Promise<Annotation[]> {
  console.log('Running TSC...');

  const modulePath = path.join(process.cwd(), 'node_modules/typescript');
  const ts = (await import(modulePath)) as typeof typescript;

  const configFilePath = ts.findConfigFile(process.cwd(), ts.sys.fileExists);

  if (configFilePath == null) {
    throw new Error('config file not found!');
  }

  const rootNames = [...filesToLint].map((file) => {
    return path.join(process.cwd(), file);
  });
  const annotations: Annotation[] = [];

  console.log('[TSC] create project');
  console.log('[NODE.JS] Memory usage', process.memoryUsage());

  const project = new Project({
    tsConfigFilePath: configFilePath,
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
    libFolderPath: path.join(modulePath, './lib'),
  });

  project.addSourceFilesAtPaths(rootNames);
  project.resolveSourceFileDependencies();

  console.log('[TSC] resolved file dependencies');
  console.log('[NODE.JS] Memory usage', process.memoryUsage());

  for (const fileName of rootNames) {
    const sourceFile = project.getSourceFile(fileName);

    if (sourceFile == null) {
      console.warn(`[TSC] could not getSourceFile() for file=${fileName}`);
      continue;
    }

    const allDiagnostics = sourceFile.getPreEmitDiagnostics();

    console.log(`[TSC] getPreEmitDiagnostics file=${sourceFile.getFilePath()}`);
    console.log('[NODE.JS] Memory usage', process.memoryUsage());

    console.log(`[TSC] Retrieved diagnostics length=${allDiagnostics.length}`);
    console.log('[NODE.JS] Memory usage', process.memoryUsage());

    for (const diagnostic of allDiagnostics) {
      const filePath = path.relative(process.cwd(), sourceFile.getFilePath());

      if (!filesToLint.has(filePath)) {
        // Ignore files  that don't need annotations
        continue;
      }

      const length = diagnostic.getLength() ?? 0;
      const start_column = diagnostic.getStart() ?? 0;
      const end_column = start_column + length;

      const start_line = diagnostic.getLineNumber() ?? 0;
      const end_line = start_line;

      const annotation_level: Annotation['annotation_level'] = 'failure';

      let message;
      const messageText = diagnostic.getMessageText();
      if (typeof messageText === 'string') {
        message = messageText;
      } else {
        message = messageText.getMessageText();
      }

      const title = `ts(${diagnostic.getCode()})`;

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
