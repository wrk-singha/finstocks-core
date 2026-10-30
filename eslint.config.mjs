// The package boundary: pure TypeScript. Anything platform-bound is a lint error here, so a helper
// that needs React, React Native, the DOM, fetch or storage cannot land in core by accident.
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const banned = [
  {
    group: ['react', 'react/*', 'react-dom', 'react-dom/*'],
    message: 'Core has no React.',
  },
  {
    group: [
      'react-native',
      'react-native/*',
      'react-native-*',
      '@react-native/*',
      '@react-native-*',
      'expo',
      'expo-*',
      '@expo/*',
    ],
    message: 'Core has no React Native.',
  },
  {group: ['@tanstack/*'], message: 'Core defines query keys, not queries.'},
  {
    group: ['axios', 'node-fetch', 'undici'],
    message: 'Core defines endpoints; the host app calls them (HttpClient).',
  },
  {
    group: [
      '@/*',
      '@app/*',
      '@features/*',
      '@shared/*',
      '@kit',
      '@services/*',
      '@navigation/*',
    ],
    message: 'Core imports nothing from an app.',
  },
];

// Inside core, import the module that defines a name, never a barrel (an area's index.ts, a bare
// area directory or the package root). Apps take core by module path for tree-shaking; one barrel
// import inside core drags the whole area's graph back into every consumer of that module.
// src/tokens/index.ts is a generated module, not a barrel, so it stays importable.
const AREAS =
  'api|data|format|fundamentals|market|portfolio|screener|strategy|trading|types';
const barrelMessage =
  'Import the module file that defines the name (e.g. ../format/number.ts), not a barrel: core must stay tree-shakeable by module.';
const noBarrels = [
  {regex: '(^|/)(?!tokens/)[^/]+/index(\\.[jt]s)?$', message: barrelMessage},
  {regex: '^\\.{1,2}(/\\.\\.)*/?(index(\\.[jt]s)?)?$', message: barrelMessage},
  {regex: `^(\\.{1,2}/)+(${AREAS})/?$`, message: barrelMessage},
  {
    group: ['@finstocks/core', '@finstocks/core/*'],
    message: 'Core does not import itself.',
  },
];

export default tseslint.config(
  {ignores: ['node_modules/**', 'tokens/dist/**', 'src/tokens/**']},
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'no-restricted-imports': ['error', {patterns: [...banned, ...noBarrels]}],
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'navigator',
        'localStorage',
        'sessionStorage',
        'fetch',
        'XMLHttpRequest',
        'WebSocket',
      ],
      '@typescript-eslint/no-non-null-assertion': 'error',
      // Types carried over from the apps are interfaces; new contracts are `type`s. Both are fine.
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        {allowNumber: true, allowBoolean: true},
      ],
      '@typescript-eslint/no-unnecessary-condition': 'off',
    },
  },
  {
    // The public root barrel is the one file that re-exports the area barrels.
    files: ['src/index.ts'],
    rules: {'no-restricted-imports': ['error', {patterns: banned}]},
  },
  {
    files: ['src/**/__tests__/**'],
    rules: {'@typescript-eslint/no-floating-promises': 'off'},
  },
  {files: ['**/*.mjs'], ...tseslint.configs.disableTypeChecked},
  {
    files: ['**/*.mjs'],
    languageOptions: {globals: {...globals.node, ...globals.es2021}},
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {argsIgnorePattern: '^_', varsIgnorePattern: '^_'},
      ],
    },
  },
);
