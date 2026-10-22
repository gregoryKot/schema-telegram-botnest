import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import { controlLabelRule } from '../eslint.a11y-labels.mjs'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      // a11y-гейт (2026-07): все правила recommended = error, плюс имя контрола
      // (control-has-associated-label, 2026-10) — в rules ниже. Общий счётчик
      // держит eslint-храповик (scripts/check-eslint-ratchet.mjs, правило №9).
      jsxA11y.flatConfigs.recommended,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      ...controlLabelRule,
      // `_`-префикс — общепринятый маркер «намеренно не используется»
      // (в коде фронта уже так помечены пропсы/деструктуры); rest-siblings
      // при omit-через-spread тоже не мусор.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    // Тестовая инфраструктура не попадает в бандл и не участвует в HMR,
    // поэтому правило про границы fast-refresh к ней неприменимо: хелпер
    // рендера обязан экспортировать и функции (renderX, моки), и держать
    // рядом маленькие компоненты-заглушки. Глушим ровно эту проверку и
    // только для тестовых файлов — остальные правила действуют как прежде.
    files: [
      '**/*.test.tsx',
      '**/*.test-helpers.tsx',
      'src/test-support/**/*.tsx',
    ],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
