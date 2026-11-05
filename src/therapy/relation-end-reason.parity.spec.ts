// Сверка (правило №4): коды причин завершения связи на бэкенде
// (relation-end-reason.ts — их пишет TherapyRelation.endReason и отдаёт
// GET /api/therapy/former-therapist) и на фронте
// (shared/src/therapy/formerTherapist.ts — по ним выбирается текст строки о
// бывшем терапевте). Разойдутся — клиент, которого убрал терапевт, прочитает
// «терапевт больше не работает в приложении». Бэкенд shared не импортирует,
// поэтому список читается из файла (образец — ysq-task-type.parity.spec.ts).
import { readFileSync } from 'fs';
import { join } from 'path';
import * as reasons from './relation-end-reason';

describe('причины завершения связи — бэкенд и фронт знают одни коды', () => {
  it('FORMER_THERAPIST_REASONS в shared — ровно константы relation-end-reason.ts', () => {
    const src = readFileSync(
      join(
        __dirname,
        '..',
        '..',
        'shared',
        'src',
        'therapy',
        'formerTherapist.ts',
      ),
      'utf8',
    );
    const block = src.match(
      /export const FORMER_THERAPIST_REASONS = \[([\s\S]*?)\] as const/,
    );
    const front = [...(block?.[1] ?? '').matchAll(/'([^']+)'/g)].map(
      (m) => m[1],
    );
    const back = Object.values(reasons).filter((v) => typeof v === 'string');
    expect(front.length).toBeGreaterThan(0);
    expect([...front].sort()).toEqual([...back].sort());
  });
});
