// @vitest-environment jsdom
// Карточки схемы и режима (b17): вид выбранной схемы/режима — из ENTITY_LOOK (домен, группа), а не на
// месте; «диалог двух голосов» выносит голос и ответ Здорового Взрослого из общего списка; состояние
// карточки после «готово» держит написанное — «Изменить карточку» не открывает пустую форму.
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { SCHEMA_DOMAINS, MODE_GROUPS } from '../../../schemaTherapyData';
import { domainLook, modeLook, ENTITY_LOOK } from '../../../../../shared/src/theme/entityLook';
import { findSchema, findMode, splitDialogue, SCHEMA_PICK_GROUPS, MODE_PICK_GROUPS } from './cardEntities';
import { useCardFlow } from './useCardFlow';

describe('cardEntities', () => {
  it('схема — бумага и знак своего домена, надпись — имя домена', () => {
    const d = SCHEMA_DOMAINS[0];
    const s = findSchema(d.schemas[0].id)!;
    expect(s.look).toEqual(domainLook(d.id));
    expect(s.group).toBe(d.domain);
    expect(s.desc).toBe(d.schemas[0].libraryDesc);
  });
  it('режим — бумага и знак группы (свой знак — у Сердитого Ребёнка)', () => {
    const g = MODE_GROUPS.find((x) => x.items.some((m) => m.id === 'punitive_critic'))!;
    expect(findMode('punitive_critic')!.look).toEqual(modeLook('punitive_critic', g.id));
    expect(findMode('angry_child')!.look.sign).toBe('flare');
  });
  it('неизвестный id — null, без выдуманного вида', () => {
    expect(findSchema('nope')).toBeNull();
    expect(findSchema(undefined)).toBeNull();
    expect(findMode('nope')).toBeNull();
  });
  it('группы выбора — все домены и группы со знаком', () => {
    expect(SCHEMA_PICK_GROUPS.map((g) => g.id)).toEqual(SCHEMA_DOMAINS.map((d) => d.id));
    expect(SCHEMA_PICK_GROUPS.every((g) => g.look.sign?.startsWith('domain_'))).toBe(true);
    expect(MODE_PICK_GROUPS.map((g) => g.items.length)).toEqual(MODE_GROUPS.map((g) => g.items.length));
    expect(MODE_PICK_GROUPS.every((g) => g.look.sign)).toBe(true);
    expect(ENTITY_LOOK.schema_card.sign).toBe('layers');
  });
});

describe('splitDialogue', () => {
  const items = [
    { key: 'triggers', text: 'когда молчат' },
    { key: 'thoughts', text: 'я плох' },
    { key: 'origins', text: '  ' },
    { key: 'healthyView', text: 'я справляюсь' },
    { key: 'behavior', text: 'позвонить' },
  ];
  it('голос и ответ — отдельно, остальное по порядку с исходным номером, пустое выпадает', () => {
    const { voice, healthy, rest } = splitDialogue(items);
    expect(voice?.text).toBe('я плох');
    expect(healthy?.text).toBe('я справляюсь');
    expect(rest.map((r) => [r.key, r.n])).toEqual([['triggers', 1], ['behavior', 5]]);
  });
  it('портрет режима: voice/healthyAdult; пустой голос — нет реплики', () => {
    const p = splitDialogue([{ key: 'voice', text: '' }, { key: 'healthyAdult', text: 'я рядом' }, { key: 'body', text: 'ком' }]);
    expect(p.voice).toBeUndefined();
    expect(p.healthy?.text).toBe('я рядом');
    expect(p.rest).toHaveLength(1);
  });
});

describe('useCardFlow', () => {
  it('«готово» хранит написанное; «Изменить» — с первого вопроса с ним же; другая схема — заново', () => {
    const { result } = renderHook(() => useCardFlow({ triggers: 'было' }));
    expect(result.current.values).toEqual({ triggers: 'было' });
    act(() => result.current.setStep(3));
    act(() => result.current.saved({ triggers: 'стало' }));
    expect(result.current.done).toBe(true);
    expect(result.current.values).toEqual({ triggers: 'стало' });
    act(() => result.current.edit());
    expect(result.current.done).toBe(false);
    expect(result.current.step).toBe(0);
    expect(result.current.values).toEqual({ triggers: 'стало' });
    act(() => result.current.reset());
    expect(result.current.values).toBeUndefined();
  });
});
