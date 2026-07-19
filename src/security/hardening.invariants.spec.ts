// Security-трипваер: глобальная защитная обвязка в main.ts (security-таск
// 2026-07-17). Всё приложение опирается на набор middleware в bootstrap:
// helmet+CSP (XSS/clickjacking/MIME-sniffing), ValidationPipe whitelist
// (mass-assignment), cap тела запроса (JSON-DoS), cookie-parser, exception-
// фильтры (не течёт внутренность ошибок), HTTPS-редирект в проде. Тихое
// удаление любого слоя ослабляет всё сразу — фиксируем присутствие каждого.
import { readFileSync } from 'fs';
import { join } from 'path';

const MAIN = readFileSync(join(__dirname, '../main.ts'), 'utf8');

describe('трипваер: hardening-middleware в main.ts', () => {
  it('helmet подключён', () => {
    expect(MAIN).toMatch(/helmet\s*\(/);
    expect(MAIN).toMatch(/app\.use\(\s*[\s\S]*helmet/);
  });

  it('CSP: defaultSrc self, objectSrc none, upgradeInsecureRequests', () => {
    expect(MAIN).toMatch(/contentSecurityPolicy/);
    expect(MAIN).toMatch(/defaultSrc:\s*\[\s*["']'self'["']/);
    expect(MAIN).toMatch(/objectSrc:\s*\[\s*["']'none'["']/);
    expect(MAIN).toMatch(/upgradeInsecureRequests/);
    // scriptSrc не должен быть открыт для 'unsafe-inline' по defaultSrc —
    // объявлен явным allowlist'ом.
    expect(MAIN).toMatch(/scriptSrc:/);
  });

  it("CSP scriptSrc не содержит 'unsafe-eval'", () => {
    const m = MAIN.match(/scriptSrc:\s*\[([^\]]*)\]/);
    expect(m).not.toBeNull();
    expect(m![1]).not.toMatch(/unsafe-eval/);
  });

  it('ValidationPipe с whitelist (mass-assignment защита)', () => {
    expect(MAIN).toMatch(/new ValidationPipe\(\s*\{[^}]*whitelist:\s*true/);
  });

  it('cap тела запроса (анти-DoS через огромный JSON)', () => {
    expect(MAIN).toMatch(/json\(\s*\{\s*limit:/);
    // лимит разумный (кб/мб, не десятки мб)
    const m = MAIN.match(/json\(\s*\{\s*limit:\s*['"]([^'"]+)['"]/);
    expect(m).not.toBeNull();
    expect(m![1]).toMatch(/kb$/i);
  });

  it('cookie-parser подключён', () => {
    expect(MAIN).toMatch(/cookieParser\(\)/);
  });

  it('exception-фильтры навешаны (не течёт внутренность ошибок)', () => {
    expect(MAIN).toMatch(/useGlobalFilters/);
    expect(MAIN).toMatch(/GenericExceptionFilter/);
    expect(MAIN).toMatch(/PrismaExceptionFilter/);
  });

  it('HTTPS/redirect-гейт только в production', () => {
    expect(MAIN).toMatch(/NODE_ENV\s*===\s*['"]production['"]/);
    expect(MAIN).toMatch(/x-forwarded-proto/);
  });

  it('CORS не открыт настежь (нет origin:true/\\*) безусловно', () => {
    // Разрешённые origin приходят из env/allowlist, а не origin: true всегда.
    expect(MAIN).not.toMatch(/enableCors\(\s*\{\s*origin:\s*true\s*\}/);
    expect(MAIN).not.toMatch(/enableCors\(\s*\{\s*origin:\s*['"]\*['"]/);
  });
});
