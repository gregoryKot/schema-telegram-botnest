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
    // Правило №9: no-floating-promises — error на всём сайте, тесты включительно.
    // До 2026-11 этот файл линтовал webapp без типов, и админская отмена брони
    // с `.then(load)` без catch прожила незамеченной. Правилу нужны типы —
    // typed linting.
    //
    // Программа одна — tsconfig.test.json (#1218): он = tsconfig.app.json плюс
    // тесты, `test-support` и `*.test-helpers.*`. Прежде прод шёл через
    // projectService, а тесты были вне правила: в tsconfig.app.json их нет,
    // `allowDefaultProject` не берёт `**`. Брошенный в тесте промис не всегда
    // валит прогон: отказ после конца теста или `act(() => promise)` без await
    // теряют проверку молча. Замер 2026-11 (`npx eslint src`, 831 тест), против
    // линта одного прода: вторая программа на тесты рядом с projectService —
    // ×1.44, одна общая программа — ×1.3 (≈30 → ≈40 с).
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.test.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': [
        'error',
        {
          // navigate() из useNavigate: под RouterProvider он async и типизирован
          // `void | Promise<void>` (документация react-router сама называет это
          // ложным срабатыванием no-floating-promises). Сбой перехода в промис
          // не попадает: ошибки загрузчиков рисует errorElement маршрута, а
          // отклоняется он только на чужом хосте, куда адреса возврата не
          // пускает safeReturnPath (src/auth/returnTo.ts). Исключение — ровно
          // тип NavigateFunction из react-router; двойник с тем же типом
          // краснеет (пин — src/test-support/eslintFloatingPromises.test.ts).
          allowForKnownSafeCalls: [
            { from: 'package', package: 'react-router', name: 'NavigateFunction' },
          ],
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
