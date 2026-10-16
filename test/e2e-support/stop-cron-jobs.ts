// Останавливает настоящие @Cron-задачи поднятого AppModule.
//
// AppModule подключает ScheduleModule.forRoot(): после app.init() все @Cron
// проекта тикают по-настоящему, прямо посреди теста. Для спека, который сам
// зовёт крон-методы напрямую (expireHolds, sendReminders…) и считает вызовы
// шпионов на уведомления админу, это чужой источник вызовов: на границе
// минуты/пятиминутки тик шлёт напоминания по броням из общей БД, и счётчик
// «ровно 1 DM» видит 4 (инцидент CI 2026-10-16 03:35 UTC, PR #722, шаг
// «e2e payment webhook smoke»). Расписание такому спеку не нужно — ему нужны
// сами методы.
//
// Задачи останавливаются в реестре, а не подменой claimRun: аренда крона —
// отдельный живой спек (cron-leader.e2e-spec.ts), а тик, прошедший её, всё
// равно пошёл бы к БД и шпионам.
import { INestApplication } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';

/** Останавливает все cron-задачи приложения; возвращает, сколько их было. */
export async function stopCronJobs(app: INestApplication): Promise<number> {
  const jobs = [...app.get(SchedulerRegistry).getCronJobs().values()];
  // stop() отдаёт промис только при waitForCompletion; без него — undefined.
  await Promise.all(jobs.map(async (job) => job.stop()));
  return jobs.length;
}

/** Имена cron-задач, которые ещё тикают (пусто после stopCronJobs). */
export function activeCronJobs(app: INestApplication): string[] {
  return [...app.get(SchedulerRegistry).getCronJobs().entries()]
    .filter(([, job]) => job.isActive)
    .map(([name]) => name);
}
