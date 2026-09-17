// Ключ localStorage для запомненной вкладки — вынесен из ProfileSection.tsx
// в отдельный файл (правка производительности 2026-08-22, разбиение
// стартового бандла). App.tsx нужен только сам ключ (getInitialSection), а
// прямой импорт из ProfileSection.tsx заставлял rollup держать весь компонент
// в графе, реально достижимом от entry синхронно — React.lazy(LazySections.tsx)
// не мог унести секцию в отдельный чанк, раз entry и так её импортирует
// (предупреждение сборки [INEFFECTIVE_DYNAMIC_IMPORT], тот же класс проблемы —
// components/childhoodWheelSheet/types.ts и hooks/useYsqTest.ts ниже).
//
// Значение ('default_section') обязано совпадать с тем, что использует сам
// ProfileSection.tsx — это уже неявный инвариант и в тестах (App.render.test.tsx
// пишет строку напрямую в localStorage), поэтому дублирование строкового
// литерала не добавляет нового риска.
export const DEFAULT_SECTION_KEY = 'default_section';
