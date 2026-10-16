// Jest setupFilesAfterEnv (test/jest-e2e.json): на живой БД обнуляет счётчики
// троттлинга перед каждым файлом спеков.
//
// Кодовые и заявочные ручки (merge, билеты, подтверждение входа, заявка
// терапевта) считают попытки в Postgres и переживают пересоздание app — как
// переживают деплой (правило №5). В одном прогоне `--runInBand` на общей БД
// это значило бы: счётчик по IP 127.0.0.1 тёк бы из файла в файл и давал 429
// там, где в проде был бы новый процесс. Раньше соседей разделяла память
// свежего app; теперь границу задаёт этот сброс. Внутри файла счётчики
// сохраняются — на этом стоит тест «рестарт не обнуляет лимит»
// (throttle-storage.e2e-spec.ts).
//
// Только при E2E_REAL_DB=1: фейковая Prisma таблицы не имеет, а DATABASE_URL
// на машине разработчика мог бы указывать куда угодно.
import { PrismaService } from '../../src/prisma/prisma.service';

beforeAll(async () => {
  if (process.env.E2E_REAL_DB !== '1') return;
  const prisma = new PrismaService();
  try {
    await prisma.throttleHit.deleteMany({});
  } finally {
    await prisma.$disconnect();
  }
});
