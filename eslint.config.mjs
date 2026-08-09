import js from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import importX from 'eslint-plugin-import-x';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/node_modules/**', 'build/**', '**/dist/**', '**/*.tsbuildinfo', '**/coverage/**', 'eslint.config.mjs'],
  },

  // Base config for all TS/TSX across the monorepo
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended, importX.flatConfigs.recommended, importX.flatConfigs.typescript, eslintPluginPrettierRecommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    settings: {
      'import-x/resolver': {
        typescript: {
          project: ['shared/tsconfig.json', 'client/tsconfig.json', 'server/tsconfig.json'],
        },
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'import-x/no-duplicates': 'off',
      'import-x/no-named-as-default': 'off',
      'import-x/no-unresolved': 'error',
      // TypeScript's compiler already validates these; the import-x versions are
      // redundant and misfire on CJS `export =` modules like React. Disable them.
      'import-x/default': 'off',
      'import-x/named': 'off',
      'import-x/namespace': 'off',
      'import-x/no-named-as-default-member': 'off',
      'import-x/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'unknown'],
          'newlines-between': 'always',
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
        },
      ],
      'prettier/prettier': [
        'error',
        {
          printWidth: 9999,
        },
      ],
      'sort-imports': [
        'error',
        {
          ignoreCase: true,
          ignoreDeclarationSort: true,
          ignoreMemberSort: false,
          memberSyntaxSortOrder: ['none', 'all', 'multiple', 'single'],
          allowSeparatedGroups: true,
        },
      ],
    },
  },

  // Client (React + browser) — restore the React linting Next's config used to provide
  {
    files: ['client/**/*.{ts,tsx}'],
    extends: [reactHooks.configs['recommended-latest']],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
  },
);
