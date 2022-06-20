import * as core from '@actions/core';
import * as github from '@actions/github';
import chunk from 'lodash/chunk';

import eslint from './eslint';
import tsc from './tsc';
import { Annotation } from './types';

async function run() {
  console.log('Processing event', github.context.eventName);
  console.log('Processing action', github.context.payload.action);

  const token = core.getInput('github_token');
  const octokit = github.getOctokit(token);
  const annotations: Annotation[] = [];

  annotations.push(...(await eslint()));
  annotations.push(...(await tsc()));

  const { sha } = github.context;
  const { owner, repo } = github.context.repo;

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
    });

    checkId = createdCheck.data.id;
  }

  const conclusion = 'success';

  for (const annotationsChunk of chunk(annotations, 50)) {
    await octokit.rest.checks.update({
      owner,
      repo,
      check_run_id: checkId,
      completed_at: new Date().toISOString(),
      conclusion,
      output: {
        annotations: annotationsChunk,
      },
    });
  }
}

run().catch((error) => {
  console.trace(error);
  core.error(error.message);
});
