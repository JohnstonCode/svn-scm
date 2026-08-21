import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import prettier from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './tsconfig.json',
      },
      globals: {
        console: 'readonly',
        Buffer: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        require: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        NodeJS: 'readonly',
        global: 'readonly',
        exports: 'readonly',
        module: 'readonly',
        Thenable: 'readonly',
        Options: 'readonly',
        EncoderStream: 'readonly',
        DecoderStream: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      prettier: prettier,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...prettierConfig.rules,
      'prettier/prettier': 'error',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/prefer-as-const': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      'no-prototype-builtins': 'off',
      'no-control-regex': 'off',
      'no-useless-escape': 'off',
      'no-async-promise-executor': 'off',
      'no-empty': 'off',
      'getter-return': 'off',
    },
  },
  {
    ignores: [
      '**/vscode.proposed.d.ts',
      'src/test/**/*.ts',
      'src/tools/**/*.ts',
      'out/**',
      'node_modules/**',
      'css/**',
    ],
  },
];