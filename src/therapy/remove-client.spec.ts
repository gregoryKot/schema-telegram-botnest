// Сверка «что терапевт хранит о клиенте» ↔ «что стирает removeTherapistClient»
// (правило №4). Инцидент 2026-10-03: диалог удаления клиента (#586) обещал
// стереть заметки и концептуализацию, а именные карты режимов (ModeMap) с той
// же парой (therapistId, clientId) оставались — у клиента с аккаунтом они
// всплывали при повторном подключении. Новая таблица с этой парой без
// удаления в removeTherapistClient роняет этот спек, а не живёт до жалобы.
import { readFileSync } from 'fs';
import { join } from 'path';

const read = (rel: string) => readFileSync(join(__dirname, rel), 'utf8');

// Модели, у которых есть и therapistId, и clientId (BigInt, не ссылка на User).
function pairModels(schema: string): string[] {
  return [...schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)]
    .filter(
      ([, , body]) =>
        /^\s+therapistId\s+BigInt\b/m.test(body) &&
        /^\s+clientId\s+BigInt\??\s/m.test(body),
    )
    .map(([, name]) => name);
}

describe('removeTherapistClient: покрытие моделей с парой (therapistId, clientId)', () => {
  const schema = read('../../prisma/schema.prisma');
  const source = read('./remove-client.ts');
  const models = pairModels(schema);

  it('находит известные модели терапевтических данных (проверка самого поиска)', () => {
    expect(models).toEqual(
      expect.arrayContaining([
        'TherapyRelation',
        'TherapistNote',
        'ClientConceptualization',
        'ModeMap',
      ]),
    );
  });

  it.each(models)('%s стирается в removeTherapistClient', (model) => {
    const delegate = model[0].toLowerCase() + model.slice(1);
    expect(source).toContain(`prisma.${delegate}.deleteMany`);
  });
});
