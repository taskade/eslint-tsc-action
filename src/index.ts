import * as core from '@actions/core';
import * as github from '@actions/github';
import chunk from 'lodash/chunk';
import path from 'path';

import eslint from './eslint';
import tsc from './tsc';
import { Annotation } from './types';

async function run() {
  console.log('Processing event', github.context.eventName);
  console.log('Processing action', github.context.payload.action);

  if (github.context.eventName !== 'pull_request') {
    throw new Error('this action only supports the `pull_request` event.');
  }

  const { issue } = github.context;
  const { owner, repo } = github.context.repo;

  const extensionsInput = core.getInput('extensions') || null;
  const extensions = new Set(
    extensionsInput?.split(',') ?? ['.js', '.jsx', '.ts', '.tsx']
  );

  const token = core.getInput('github_token');
  const octokit = github.getOctokit(token);

  // Fetch pull request information

  const pullRequestNumber = issue.number;

  const pullRequest = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: pullRequestNumber,
  });

  const sha = pullRequest.data.head.sha;

  // Fetch list of changed files

  const filesToLint = new Set<string>();

  let pullRequestChangedFiles: Awaited<
    ReturnType<typeof octokit.rest.pulls.listFiles>
  >;

  let pullRequestChangedFilesPage = 1;

  do {
    pullRequestChangedFiles = await octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: pullRequestNumber,
      per_page: 100,
      page: pullRequestChangedFilesPage,
    });

    for (const file of pullRequestChangedFiles.data) {
      if (file.status === 'removed' || file.status === 'unchanged') {
        continue;
      }

      const fileExtension = path.extname(file.filename);
      if (!extensions.has(fileExtension)) {
        continue;
      }

      filesToLint.add(file.filename);
    }

    pullRequestChangedFilesPage++;
  } while (pullRequestChangedFiles.data.length > 0);

  console.log(`Linting ${filesToLint.size} files`, [...filesToLint]);

  // Run ESLint and TSC

  let annotationCount = 0;

  const checkName = core.getInput('check_name') || 'ESLint TSC Action';
  let checkId: number | null = null;

  async function submitAnnotations(annotations: Annotation[]) {
    if (checkName.length > 0) {
      const checks = await octokit.rest.checks.listForRef({
        owner,
        repo,
        status: 'in_progress',
        check_name: checkName,
        ref: sha,
      });

      if (checks.data.check_runs.length > 0) {
        checkId = checks.data.check_runs[0].id;
      }
    }

    if (checkId == null) {
      const createdCheck = await octokit.rest.checks.create({
        owner,
        repo,
        name: checkName,
        head_sha: sha,
        status: 'in_progress',
        started_at: new Date().toISOString(),
      });

      checkId = createdCheck.data.id;
    } else {
      // Mark existing check run as in progress
      await octokit.rest.checks.update({
        owner,
        repo,
        check_run_id: checkId,
        status: 'in_progress',
        started_at: new Date().toISOString(),
      });
    }

    console.log(`Processing ${annotations.length} annotations for SHA ${sha}`);

    for (const annotationsChunk of chunk(annotations, 50)) {
      await octokit.rest.checks.update({
        owner,
        repo,
        check_run_id: checkId,
        status: 'in_progress',
        output: {
          title: `Found ${annotationCount} annotations`,
          summary: `Found ${annotationCount} annotations`,
          annotations: annotationsChunk,
        },
      });
    }
  }

  const eslintAnnotations = await eslint(filesToLint);
  console.log('Completed ESLint');
  annotationCount += eslintAnnotations.length;
  await submitAnnotations(eslintAnnotations);

  const tscAnnotations = await tsc(filesToLint);
  console.log('Completed TSC');
  annotationCount += tscAnnotations.length;
  await submitAnnotations(tscAnnotations);

  // Mark check run as completed
  await octokit.rest.checks.update({
    owner,
    repo,
    check_run_id: checkId,
    completed_at: new Date().toISOString(),
    conclusion: 'success',
    status: 'completed',
  });
}

run().catch((error) => {
  console.trace(error);
  core.error(error.message);
});
