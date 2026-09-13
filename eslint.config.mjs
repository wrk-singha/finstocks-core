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
      'no-restricted-imports': ['error', {patterns: banned}],
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
