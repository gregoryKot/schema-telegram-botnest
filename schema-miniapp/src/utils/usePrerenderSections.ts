import { startTransition, useEffect, useRef, useState } from 'react';
import type { Section } from '../components/BottomNav';
import { perfMark } from './perfLog';

const ALL_SECTIONS: Section[] = ['today', 'schemas', 'help', 'profile'];

/** Пауза между сборками скрытых вкладок. Первая версия хука ждала «простоя»
 *  через onIdle, но на iOS requestIdleCallback нет — фолбэк ждал всего 600мс,
 *  и сборки врезались в самую занятую фазу старта: панель замеров на телефоне
 *  владельца (2026-08-26) показала блоки 1.7-1.9с ровно на метках
 *  сборка:schemas/help/profile (5.1с, 6.8с, 8.4с жизни), и тапы этих секунд
 *  стояли за ними в очереди. 2.5с разносит сборки друг от друга и от пика
 *  стартовых запросов — тап, попавший между ними, ждёт максимум одну. */
const PRERENDER_SPACING_MS = 2500;

/**
 * Собирает скрытые вкладки заранее — по одной, с паузой, начиная после того,
 * как данные первого экрана приехали (ready=true). Третий и последний ярус
 * прогрева: код секций тянет preloadSections, данные — prefetchSectionData,
 * а сам ТЯЖЁЛЫЙ ПЕРВЫЙ КОММИТ экрана до этого хука никто не оплачивал
 * заранее — он случался прямо в момент первого тапа (~0.5-1с замершего
 * экрана, замер 2026-08-24). Теперь коммит уходит в паузы между стартовой
 * работой: KeepMountedSection монтирует вкладку скрытой (и замораживает до
 * показа), и первый тап — уже переключение видимости.
 *
 * Тап по ещё не собранной вкладке работает как раньше (скелетон первым
 * кадром) и сам же её монтирует — гонки с планом нет, KeepMountedSection
 * идемпотентен.
 */
export function usePrerenderSections(
  ready: boolean,
  current: Section,
): Set<Section> {
  const [prerendered, setPrerendered] = useState<Set<Section>>(new Set());
  const started = useRef(false);
  // Реф-зеркало: план фиксирует вкладку на момент готовности, смена вкладки
  // его не перестраивает — и не попадает в зависимости эффекта.
  const currentRef = useRef(current);
  currentRef.current = current;

  useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;
    const rest = ALL_SECTIONS.filter((s) => s !== currentRef.current);
    const timers = rest.map((section, i) =>
      setTimeout(
        () => {
          perfMark(`сборка:${section}`);
          // startTransition: сборка скрытой вкладки — НИЗКОПРИОРИТЕТНЫЙ,
          // ПРЕРЫВАЕМЫЙ рендер: тап, пришедший во время неё, React
          // обрабатывает первым и достраивает вкладку после.
          startTransition(() =>
            setPrerendered((prev) => {
              if (prev.has(section)) return prev;
              const next = new Set(prev);
              next.add(section);
              return next;
            }),
          );
        },
        PRERENDER_SPACING_MS * (i + 1),
      ),
    );
    return () => timers.forEach(clearTimeout);
  }, [ready]);

  return prerendered;
}
