import { startTransition, useEffect, useRef, useState } from 'react';
import type { Section } from '../components/BottomNav';
import { onIdle } from './preloadSections';
import { perfMark } from './perfLog';

const ALL_SECTIONS: Section[] = ['today', 'schemas', 'help', 'profile'];

/**
 * Собирает скрытые вкладки заранее — по одной за виток простоя, начиная
 * после того, как данные первого экрана приехали (ready=true). Третий и
 * последний ярус прогрева: код секций тянет preloadSections, данные —
 * prefetchSectionData, а сам ТЯЖЁЛЫЙ ПЕРВЫЙ КОММИТ экрана до этого хука
 * никто не оплачивал заранее — он случался прямо в момент первого тапа
 * (~0.5-1с замершего экрана на телефонном профиле CPU 6x, замер
 * 2026-08-24; «ничего не поменялось» после keep-mounted — болели именно
 * первые открытия). Теперь коммит уходит в простой: KeepMountedSection
 * монтирует вкладку скрытой, и первый тап — уже переключение видимости.
 *
 * По одной за виток — сборка секции блокирует главный поток на сотни
 * миллисекунд; подряд все три заморозили бы приложение заметно для пальца.
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

  useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;
    const rest = ALL_SECTIONS.filter((s) => s !== current);
    function mountNext(index: number): void {
      if (index >= rest.length) return;
      onIdle(() => {
        // Метка для панели замеров: видно, толкается ли фоновая сборка
        // вкладок с тапами владельца в первую минуту (perfLog).
        perfMark(`сборка:${rest[index]}`);
        // startTransition: сборка скрытой вкладки — НИЗКОПРИОРИТЕТНЫЙ,
        // ПРЕРЫВАЕМЫЙ рендер. Без него фоновый коммит блокировал главный
        // поток сотнями миллисекунд, и тап, попавший в эту блокировку,
        // ждал её целиком («первую минуту ужасно», владелец 2026-08-24:
        // прогрев переложил работу с тапа в фон, но фон — это и есть
        // первая минута). React прерывает transition на входе пользователя,
        // обрабатывает тап и достраивает вкладку после.
        startTransition(() =>
          setPrerendered((prev) => {
            if (prev.has(rest[index])) return prev;
            const next = new Set(prev);
            next.add(rest[index]);
            return next;
          }),
        );
        mountNext(index + 1);
      });
    }
    mountNext(0);
    // Только по ready: current фиксируется на момент готовности (started-гард),
    // смена вкладки план не перестраивает.
  }, [ready, current]);

  return prerendered;
}
