import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import hooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'artifacts/**',
      'android/**',
      '.android-sdk/**',
      '.android-assets/**',
      '.android-keys/**',
      '.gradle-cache/**',
      'src/integrations/gamehub/vendor/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': hooks },
    rules: hooks.configs.recommended.rules,
  },
  {
    files: ['src/features/game/engine/**/*.ts'],
    ignores: ['**/__tests__/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['react', 'react-dom', 'dexie', '@brand/*', '**/brand/*'] },
      ],
      'no-restricted-globals': ['error', 'window', 'document', 'fetch'],
    },
  },
  prettier,
);
