import { Endpoints } from '@octokit/types';

export type UpdateCheckRunOutput = NonNullable<
  Endpoints['PATCH /repos/{owner}/{repo}/check-runs/{check_run_id}']['parameters']['output']
>;

export type Annotation = NonNullable<UpdateCheckRunOutput['annotations']>[0];
