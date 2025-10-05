// Conventional Commits for this repo
// https://www.conventionalcommits.org/

/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  rules: {
    'header-max-length': [2, 'always', 72],
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'refactor',
        'perf',
        'test',
        'chore',
        'build',
        'ci',
        'docs'
      ]
    ],
    'type-case': [2, 'always', 'lower-case'],
    // scopes are lowercase identifiers for areas of the monorepo
    'scope-enum': [2, 'always', ['api', 'web', 'schemas', 'infra', 'docs', 'ops', 'ci', 'build']],
    'scope-case': [2, 'always', 'lower-case'],
    // Allow Korean or mixed-language subjects; do not enforce subject-case
    'subject-case': [0],
    'subject-empty': [2, 'never']
  }
};
