import globals from 'globals';
import { defineConfig } from 'eslint/config';

import eslintJS from '@eslint/js';
import eslintTS from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';
import checkFile from 'eslint-plugin-check-file';

export default defineConfig({
  // Files to lint
  files: ['source/**/*.ts', '.config/**/*.ts'],

  // Recommended rules
  extends: [eslintJS.configs.recommended, eslintTS.configs.recommendedTypeChecked, eslintTS.configs.stylisticTypeChecked],

  // Language specific configuration
  languageOptions: {
    // Parser required for eslint to work with typescript
    parser: eslintTS.parser,

    // Additional options for the parser
    parserOptions: {
      // Allows parser to reference available 'tsconfig.json' file
      project: true,
      tsconfigRootDir: process.cwd(),
    },

    // Globals that should be ignored by 'no-undef' rule
    globals: {
      ...globals.browser,
      ...globals.node,
    },
  },

  // Additional plugins
  plugins: {
    'check-file': checkFile,
    '@stylistic': stylistic,
  },

  // Individual rules
  rules: {
    /* USI Typescript Style Guide */
    'no-var': 'error',
    'prefer-const': 'error',
    'no-useless-concat': 'error',
    'prefer-template': 'error',
    'prefer-arrow-callback': 'error',
    'eqeqeq': 'error',
    'no-else-return': 'error',
    'no-lonely-if': 'error',

    '@stylistic/line-comment-position': 'warn',
    '@stylistic/spaced-comment': 'warn',
    '@stylistic/multiline-comment-style': ['warn', 'bare-block'],

    /* Additional Rules */
    'no-template-curly-in-string': 'error',

    '@typescript-eslint/naming-convention': [
      'warn',
      { selector: 'classMethod', format: ['snake_case'] },
      { selector: 'function', format: ['snake_case'] },
      { selector: 'typeLike', format: ['PascalCase'] },
      { selector: 'variableLike', format: ['camelCase', 'UPPER_CASE', 'snake_case'] },
    ],
    '@typescript-eslint/explicit-member-accessibility': ['error', { overrides: { constructors: 'off' } }],
    '@typescript-eslint/no-shadow': 'error',
    '@typescript-eslint/prefer-nullish-coalescing': 'off',
    '@typescript-eslint/consistent-type-definitions': 'off',
    '@typescript-eslint/consistent-indexed-object-style': 'off',
    '@typescript-eslint/dot-notation': 'off',
    '@typescript-eslint/restrict-template-expressions': 'off',

    'check-file/folder-naming-convention': ['error', { 'source/**/': 'KEBAB_CASE' }],
    'check-file/filename-naming-convention': ['error', { 'source/**/*.ts': 'KEBAB_CASE' }, { ignoreMiddleExtensions: true }],
  },
});
