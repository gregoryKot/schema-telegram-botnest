import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import jsxA11y from 'eslint-plugin-jsx-a11y'
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
      // a11y-гейт (best-practice, 2026-07): ~100 aria-label проставлены
      // руками, но регрессии ничем не ловились. Все правила = error, код
      // приведён в соответствие (интерактивные div → pressable/role+keydown,
      // label↔control, autoFocus → ref+effect). Общий счётчик держит
      // eslint-храповик (scripts/check-eslint-ratchet.mjs, правило №9).
      jsxA11y.flatConfigs.recommended,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
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
])
