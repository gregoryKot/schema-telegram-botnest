// Разбор таблиц маршрутов App.tsx для тестов (robots.txt, внутренние ссылки): тест читает
// настоящий App.tsx, а не копию списка. Здесь без node:fs — модуль в сборке tsc.

export type RouteTableName = 'appRoutes' | 'personalRoutes';

/** Тело `const <name> = [ … ];` из исходника App.tsx. */
export function routeTableBlock(app: string, name: RouteTableName): string {
  const block = new RegExp(`const ${name} = \\[([\\s\\S]*?)\\n\\];`).exec(app)?.[1];
  if (!block) {
    throw new Error(`В App.tsx нет блока \`const ${name} = [ … ];\` — разбор в test-support/appRoutes.ts устарел`);
  }
  return block;
}

/** Шаблоны `path: '…'` куска таблицы без `*`; параметры (`:slug`) — как в App.tsx. */
export function routePaths(block: string): string[] {
  return [...block.matchAll(/path:\s*'([^']+)'/g)].map((m) => m[1]).filter((p) => p !== '*');
}
