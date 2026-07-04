export default {
  '*.{ts,js,mjs,cjs,json,md,yml,yaml}':
    'prettier --config .config/prettier/prettier.config.mjs --ignore-path .config/prettier/.prettierignore --write',
};
