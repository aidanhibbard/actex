import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import json from '@eslint/json'
import markdown from '@eslint/markdown'
import checkFile from 'eslint-plugin-check-file'
import { defineConfig } from 'eslint/config'
import eslintConfigPrettier from 'eslint-config-prettier'
import eslintPluginPrettier from 'eslint-plugin-prettier'

const tsFiles = ['**/*.{ts,mts,cts}'] as const
const tsIgnores = ['eslint.config.ts', 'tsdown.config.ts', 'vitest.config.ts']

export default defineConfig(
  {
    ignores: [
      '.agents/**',
      'dist/**',
      'node_modules/**',
      'package-lock.json',
      'pnpm-lock.yaml',
    ],
  },
  eslintConfigPrettier,
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
    ignores: [...tsIgnores],
    plugins: { prettier: eslintPluginPrettier },
    rules: {
      'prettier/prettier': [
        'error',
        { singleQuote: true, semi: false, trailingComma: 'all' },
      ],
    },
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
    ignores: [...tsIgnores],
    plugins: { js },
    extends: ['js/recommended'],
    languageOptions: { globals: globals.node },
  },
  ...tseslint.configs.strictTypeChecked.map((config) => ({
    ...config,
    files: [...tsFiles],
    ignores: [...tsIgnores],
  })),
  ...tseslint.configs.stylisticTypeChecked.map((config) => ({
    ...config,
    files: [...tsFiles],
    ignores: [...tsIgnores],
  })),
  {
    files: [...tsFiles],
    ignores: [...tsIgnores],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'default',
          format: ['strictCamelCase'],
          leadingUnderscore: 'allow',
          trailingUnderscore: 'forbid',
        },
        {
          selector: 'import',
          format: ['strictCamelCase', 'StrictPascalCase'],
        },
        {
          selector: 'variable',
          format: ['strictCamelCase', 'UPPER_CASE'],
          leadingUnderscore: 'allow',
        },
        {
          selector: 'typeLike',
          format: ['StrictPascalCase'],
        },
        {
          selector: 'enumMember',
          format: ['StrictPascalCase'],
        },
        {
          selector: 'objectLiteralProperty',
          format: ['strictCamelCase', 'UPPER_CASE'],
          leadingUnderscore: 'allow',
          filter: {
            regex: '^\\d+$',
            match: false,
          },
        },
      ],
    },
  },
  {
    files: [...tsFiles],
    ignores: [...tsIgnores],
    plugins: { 'check-file': checkFile },
    rules: {
      'check-file/folder-naming-convention': [
        'error',
        {
          'lib/**/': 'KEBAB_CASE',
          'src/**/': 'KEBAB_CASE',
          'tests/**/': 'KEBAB_CASE',
        },
      ],
    },
  },
  {
    files: ['package.json'],
    plugins: { json },
    language: 'json/json',
    extends: ['json/recommended'],
  },
  {
    files: ['**/*.md'],
    plugins: { markdown },
    language: 'markdown/commonmark',
    extends: ['markdown/recommended'],
  },
)
