// Flat ESLint config (ESLint v9 + typescript-eslint v8).
//
// Scope: TS/TSX source under packages/. Uses the TS-aware `recommended` preset
// (NOT type-checked, so it needs no tsconfig wiring and stays fast). The two
// rules most likely to fire on in-progress code are downgraded to warnings so
// `eslint` exits 0 on the current tree; tighten them to 'error' as the code
// firms up. Run: `npm run lint`.
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      'vendor/**',
      '_archive/**',
      'generated/**',
      'mockups/**',
      'templates/**',
      '**/*.d.ts',
      '**/*.js',
      '**/*.mjs',
      '**/*.cjs',
    ],
  },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      '@typescript-eslint/no-empty-function': 'off',
    },
  },
);
