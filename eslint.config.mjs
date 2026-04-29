// ESLint v9+ Flat-Config für TypeScript/Node-ESM.
// Verwendet das Meta-Paket `typescript-eslint` (v8) statt manuell
// `@typescript-eslint/parser` + `@typescript-eslint/eslint-plugin` einzubinden —
// das ist der offiziell empfohlene Flat-Config-Pfad und vermeidet
// Versions-Drift zwischen Parser und Plugin.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    // Global ignores — betrifft alle Einträge.
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      // Unused vars als Fehler, aber `_`-Präfix als bewusstes Ignorier-Muster
      // (typisch für ungenutzte Callback-Parameter).
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'warn',
      // MCP-stdio-Sensibilisierung: Kein console.log nach stdout.
      // `console.error` und `console.warn` gehen nach stderr und sind erlaubt.
      'no-console': ['error', { allow: ['error', 'warn'] }],
    },
  },
  {
    // Test-Dateien: Pragmatische Lockerungen. Tests dürfen `any` (Jest-Mocks),
    // und console ist ohnehin kein stdio-MCP-Kontext.
    files: ['src/**/__tests__/**/*.ts', 'src/**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },
  // Prettier zuletzt, deaktiviert alle stilistischen ESLint-Regeln,
  // die mit Prettier kollidieren würden.
  prettier,
);
