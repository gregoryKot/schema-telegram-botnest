// Самопроверка прода (правило №14 CLAUDE.md, инциденты 2026-09-13/16 —
// регресс календаря и цикл OAuth жили на проде по несколько дней, пока их не
// нашёл человек). Общая форма пробы — раннер ничего не знает о конкретных
// проверках, каждая проба маленькая и независимая (образец —
// buildCapabilityReport в ../capability-report.ts).
export interface ProbeResult {
  ok: boolean;
  /** Человеческим языком — что именно проверено/сломано. Без секретов. */
  detail: string;
}

export interface Probe {
  /** Слаг для /health и /stats. */
  id: string;
  /** Человеческое имя для /stats и DM. */
  title: string;
  /** true — падение этой пробы означает, что сигнализация/ядро сломаны. */
  critical: boolean;
  run(): Promise<ProbeResult>;
}
