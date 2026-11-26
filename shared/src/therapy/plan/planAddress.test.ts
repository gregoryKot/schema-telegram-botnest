import { describe, it, expect } from 'vitest';
import {
  listAddresses,
  parseAddress,
  resolveAddress,
} from '../../schemaTherapy/guide/address';
import { GUIDE_CHANNELS } from './planItem';
import { legacyPlanSourceAddress, planItemAddress } from './planAddress';

// Поля, которые кнопки «В план» писали в старый источник (guidePlan.ts до адресов).
const OLD_FIELDS = [
  ...GUIDE_CHANNELS.map((c) => c.id),
  'techniques',
  'betweenSessions',
];

describe('legacyPlanSourceAddress: старый источник → адрес раздела', () => {
  it.each(['schema', 'mode', 'technique'] as const)(
    '%s: каждый раздел верхнего уровня переводится туда и обратно',
    (kind) => {
      const top = listAddresses(kind)
        .map((a) => parseAddress(a)!)
        .filter((p) => !p.path.includes('.'));
      expect(top.length).toBeGreaterThan(0);
      for (const p of top) {
        const address = legacyPlanSourceAddress({
          kind,
          id: p.articleId,
          field: p.path,
        });
        expect(address).toBe(`${kind}:${p.articleId}/${p.path}`);
        expect(resolveAddress(address!)).not.toBeNull();
      }
    },
  );

  it('всё, что писали кнопки «В план» режима и схемы, находит раздел', () => {
    const fromButtons = listAddresses()
      .map((a) => parseAddress(a)!)
      .filter(
        (p) =>
          (p.kind === 'mode' || p.kind === 'schema') &&
          OLD_FIELDS.includes(p.path),
      );
    expect(fromButtons.length).toBeGreaterThan(0);
    for (const p of fromButtons)
      expect(
        resolveAddress(
          legacyPlanSourceAddress({
            kind: p.kind as 'mode',
            id: p.articleId,
            field: p.path,
          })!,
        )?.text,
      ).toBeTruthy();
  });

  it('переименованный раздел — через реестр', () => {
    const renames = { 'mode:*/experiential': 'mode:*/feelings' };
    expect(
      legacyPlanSourceAddress(
        { kind: 'mode', id: 'vulnerable_child', field: 'experiential' },
        renames,
      ),
    ).toBe('mode:vulnerable_child/feelings');
  });

  it('не переводится — null (старые колонки остаются как есть)', () => {
    expect(legacyPlanSourceAddress(null)).toBeNull();
    expect(
      legacyPlanSourceAddress({
        kind: 'note' as 'mode',
        id: 'x',
        field: 'body',
      }),
    ).toBeNull();
    expect(
      legacyPlanSourceAddress({ kind: 'mode', id: 'x', field: '1bad' }),
    ).toBeNull();
    expect(
      legacyPlanSourceAddress({ kind: 'mode', id: 'a b', field: 'goal' }),
    ).toBeNull();
  });
});

describe('planItemAddress', () => {
  it('сохранённый адрес главнее старого источника; без обоих — null', () => {
    const source = {
      kind: 'mode' as const,
      id: 'vulnerable_child',
      field: 'cognitive',
    };
    expect(
      planItemAddress({
        sourceAddress: 'schema:abandonment/cognitive',
        source,
      }),
    ).toBe('schema:abandonment/cognitive');
    expect(planItemAddress({ sourceAddress: null, source })).toBe(
      'mode:vulnerable_child/cognitive',
    );
    expect(planItemAddress({ sourceAddress: null, source: null })).toBeNull();
  });
});
