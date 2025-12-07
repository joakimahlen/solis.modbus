// eslint-disable-next-line no-undef
module.exports = {
  root: true,
  env: {
    node: true,
    es2020: true,
  },
  extends: ['athom/homey-app'],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  settings: {
    'import/resolver': {
      typescript: {
        project: './tsconfig.json',
      },
      node: {
        extensions: ['.js', '.ts'],
      },
    },
  },
  rules: {
    'object-curly-newline': 'off',
    'no-restricted-properties': 'off',
    'import/prefer-default-export': 'off',
    'node/no-missing-import': 'off',
    'no-empty-pattern': 'off',
    'no-console': 'off',
    '@typescript-eslint/no-floating-promises': 'off',
    indent: ['error', 2],
    'max-len': ['error', { code: 300 }],
    'import/extensions': [
      'error',
      'ignorePackages',
      {
        js: 'never',
        ts: 'never',
      },
    ],
  },
};
