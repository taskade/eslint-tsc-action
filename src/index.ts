import * as core from '@actions/core';
import * as github from '@actions/github';
import chunk from 'lodash/chunk';

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
      filesToLint.add(file.filename);
    }

    pullRequestChangedFilesPage++;
  } while (pullRequestChangedFiles.data.length > 0);

  console.log(`Linting ${filesToLint.size} files`, [...filesToLint]);

  // Run ESLint and TSC

  const annotations: Annotation[] = [];

  annotations.push(...(await eslint(filesToLint)));
  annotations.push(...(await tsc(filesToLint)));

  const checkName = core.getInput('check_name');
  let checkId: number | null = null;

  if (checkName.length > 0) {
    const checks = await octokit.rest.checks.listForRef({
      owner,
      repo,
      status: 'in_progress',
      ref: sha,
    });

    for (const check of checks.data.check_runs) {
      if (check.name !== checkName) {
        continue;
      }

      checkId = check.id;
    }
  }

  if (checkId == null) {
    const createdCheck = await octokit.rest.checks.create({
      owner,
      repo,
      name: checkName || 'ESLint TSC Action',
      head_sha: sha,
      status: 'in_progress',
      started_at: new Date().toISOString(),
    });

    checkId = createdCheck.data.id;
  }

  console.log(`Processing ${annotations.length} annotations for SHA ${sha}`);

  const conclusion = 'success';

  for (const annotationsChunk of chunk(annotations, 50)) {
    await octokit.rest.checks.update({
      owner,
      repo,
      check_run_id: checkId,
      completed_at: new Date().toISOString(),
      conclusion,
      output: {
        title: `Found ${annotations.length} annotations`,
        summary: `Found ${annotations.length} annotations`,
        annotations: annotationsChunk,
      },
    });
  }
}

run().catch((error) => {
  console.trace(error);
  core.error(error.message);
});
