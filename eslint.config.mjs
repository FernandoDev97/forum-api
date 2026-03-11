// @ts-check
import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import globals from 'globals'
import prettierRecommended from 'eslint-plugin-prettier/recommended'

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
    rules: {
      // ─── Prettier (mesmas opções da Rocketseat) ───────────────────────────
      'prettier/prettier': [
        'error',
        {
          printWidth: 80,
          tabWidth: 2,
          singleQuote: true,
          trailingComma: 'all',
          arrowParens: 'always',
          semi: false,
        },
      ],

      // ─── TypeScript ───────────────────────────────────────────────────────

      // Desativa versão do core (não entende TS parameter properties) e usa a TS-aware
      'no-useless-constructor': 'off',
      '@typescript-eslint/no-useless-constructor': 'error',

      '@typescript-eslint/no-explicit-any': 'warn',

      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      // NestJS usa decorators e classes extensivamente — não forçar tipos de retorno
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',

      // Permite construtores vazios (injeção de dependência do NestJS)
      '@typescript-eslint/no-empty-function': [
        'error',
        { allow: ['constructors'] },
      ],

      // Desativado: `import type` é incompatível com emitDecoratorMetadata do NestJS.
      // Classes usadas como tokens de injeção precisam estar presentes em runtime.
      '@typescript-eslint/consistent-type-imports': 'off',

      // ─── Regras equivalentes ao eslint-config-standard ───────────────────
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-wrappers': 'error',
      'no-return-assign': ['error', 'except-parens'],
      'no-sequences': 'error',
      'no-extra-bind': 'error',
      'no-useless-call': 'error',
      'prefer-promise-reject-errors': 'error',
      'no-console': 'warn',
    },
  },
)
