# eslint-tsc-action
This GitHub Action runs ESLint and TSC against a repository, providing GitHub PR annotations.

### Sample workflow
```yaml
name: ESLint and TSC
on:
  pull_request:
    types: [opened,edited,synchronize]
  pull_request_review:
    types: [submitted]

jobs:
  lint:
    name: Lint
    runs-on: 'ubuntu-latest'

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 16
      - run: yarn install
      - uses: taskade/eslint-tsc-action@main
```
