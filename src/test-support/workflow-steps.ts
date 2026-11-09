// Шаги GitHub-воркфлоу для спеков, которые ИСПОЛНЯЮТ `run:` настоящего YAML
// (src/infra/alarm-workflow.spec.ts, src/infra/prod-smoke-health.spec.ts):
// шов — сам скрипт воркфлоу, не его пересказ. YAML-парсера в зависимостях нет,
// шаги режутся по отступу; слом отступа многострочного run (известная ловушка
// аудита 2026-09) ломает и этот разбор.

/** Тело джобы `name`: от её ключа до следующего ключа джобы (отступ 2). */
export function jobBody(yml: string, name: string): string {
  const start = yml.search(new RegExp(`^ {2}${name}:\\n`, 'm'));
  if (start < 0) throw new Error(`джобы ${name} нет`);
  const rest = yml.slice(start + 1);
  const next = rest.search(/^ {2}\S/m);
  return next < 0 ? rest : rest.slice(0, next);
}

/** Шаги джобы: каждый начинается с `      - ` (отступ 6). */
export function steps(job: string): string[] {
  return job.split(/^ {6}- /m).slice(1);
}

export const stepName = (s: string) => /^name: (.*)$/m.exec(s)?.[1] ?? '';

/** Скрипт многострочного `run: |` шага, без отступа. */
export function runBlock(step: string): string {
  const lines = step.split('\n');
  const at = lines.findIndex((l) => /^ {8}run: \|\s*$/.test(l));
  if (at < 0) throw new Error(`у шага «${stepName(step)}» нет run: |`);
  const body: string[] = [];
  for (const l of lines.slice(at + 1)) {
    if (l.trim() !== '' && !l.startsWith(' '.repeat(10))) break;
    body.push(l.slice(10));
  }
  return body.join('\n');
}
