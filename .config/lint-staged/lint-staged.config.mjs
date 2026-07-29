export default {
  '*.ts': [
    'eslint --config .config/eslint/eslint.config.mjs --fix',
    'prettier --config .config/prettier/prettier.config.mjs --ignore-path .config/prettier/.prettierignore --write',
  ],
  '*.{js,mjs,cjs,json,md,yml,yaml}':
    'prettier --config .config/prettier/prettier.config.mjs --ignore-path .config/prettier/.prettierignore --write',
  // .prettierignore excludes .claude wholesale and gitignore semantics forbid re-including a
  // subdirectory of an excluded directory, so the authoring CLIs get their own pass with no
  // --ignore-path. Scoped to this folder: the rest of .claude stays unformatted.
  '.claude/scripts/*.cjs': 'prettier --config .config/prettier/prettier.config.mjs --write',
};
