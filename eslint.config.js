import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  { ignores: ['dist/**', 'builds/**', '.npm-cache/**', '.test-browsers/**', 'test-results/**', 'playwright-report/**'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: { ...globals.browser, ...globals.serviceworker, chrome: 'readonly' },
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
  {
    files: ['tests/**/*.js', 'scripts/**/*.js', '*config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['tests/browser/*.js'],
    languageOptions: { globals: { __message: 'readonly', __setPrefs: 'readonly', __getPrefs: 'readonly', __sent: 'readonly', __injected: 'readonly', __writes: 'readonly', __install: 'readonly' } },
  },
]
