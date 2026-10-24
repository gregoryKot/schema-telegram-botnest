import { isPerfHudEnabled, perfMark } from './perfLog';

// Переключатели экспериментов для A/B на устройстве владельца. Прогон v3
// (2026-08-26) сузил круг: метроном ~1.5с замирает ВЕСЬ событийный цикл
// (таймер-паузы = кадровые блоки), страница видима+в фокусе, а в фоне
// метроном исчезает (остаётся штатный 1с-троттлинг) — значит виновник
// работает только пока экран виден: конвейер отрисовки. Кандидаты, которые
// нельзя различить дистанционно, выключаются по одному прямо на телефоне:
// тумблеры в PerfHud, каждый прогон — с чистого старта.
export type PerfExperiment = 'noanim' | 'noblur';
const EXP_KEYS: Record<PerfExperiment, string> = {
  noanim: 'perf_exp_noanim',
  noblur: 'perf_exp_noblur',
};
const EXP_CSS: Record<PerfExperiment, string> = {
  noanim:
    '*,*::before,*::after{animation:none!important;transition:none!important}',
  noblur:
    '*{backdrop-filter:none!important;-webkit-backdrop-filter:none!important;filter:none!important}',
};

export function isExperimentOn(exp: PerfExperiment): boolean {
  return localStorage.getItem(EXP_KEYS[exp]) === '1';
}

/** Переключает эксперимент и перезагружает страницу — чтобы стиль
 *  действовал с первого кадра, а не с середины прогона. */
export function toggleExperiment(exp: PerfExperiment): void {
  localStorage.setItem(EXP_KEYS[exp], isExperimentOn(exp) ? '0' : '1');
  window.location.reload();
}

/** Вызывается из main до рендера: вкалывает CSS включённых экспериментов и
 *  помечает их в метках — отчёт сам документирует условия прогона. */
export function applyExperiments(): void {
  if (!isPerfHudEnabled()) return;
  for (const exp of Object.keys(EXP_CSS) as PerfExperiment[]) {
    if (!isExperimentOn(exp)) continue;
    const style = document.createElement('style');
    style.textContent = EXP_CSS[exp];
    document.head.appendChild(style);
    perfMark(`экспер:${exp}`);
  }
}
