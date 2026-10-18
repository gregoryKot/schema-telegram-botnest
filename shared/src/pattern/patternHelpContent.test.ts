import { describe, it, expect } from 'vitest';
import { resolveModeHelp, resolveSchemaHelp } from './patternHelpContent';
import { patternMeta, schemaMeta, modeMeta } from './patternMeta';

describe('resolveModeHelp', () => {
  it('известный режим: голос Здорового Взрослого и потребность из карточки', () => {
    const h = resolveModeHelp('vulnerable_child');
    expect(h.adultText.length).toBeGreaterThan(0);
    expect(h.needText).toBeTruthy();
  });

  it('неизвестный режим: нейтральный голос есть, потребности нет (null, не выдумка)', () => {
    const h = resolveModeHelp('no_such_mode');
    expect(h.adultText.length).toBeGreaterThan(0);
    expect(h.needText).toBeNull();
  });
});

describe('resolveSchemaHelp', () => {
  it('известная схема: совет и потребность, совет разведён по форме обращения', () => {
    const ty = resolveSchemaHelp('abandonment', 'ty');
    const vy = resolveSchemaHelp('abandonment', 'vy');
    expect(ty.tip).toBeTruthy();
    expect(ty.needName).toBeTruthy();
    expect(ty.needLine).toBeTruthy();
    expect(vy.tip).toBeTruthy();
  });

  it('неизвестная схема: всё null — блок просто не рисуется', () => {
    expect(resolveSchemaHelp('no_such_schema', 'ty')).toEqual({
      tip: null,
      needName: null,
      needLine: null,
    });
  });
});

describe('patternMeta', () => {
  it('схема: название, цвет и подпись домена; режим — группы', () => {
    expect(schemaMeta('abandonment')).toMatchObject({
      subtitle: expect.any(String),
    });
    expect(modeMeta('vulnerable_child')).toMatchObject({
      name: expect.any(String),
    });
  });

  it('неизвестный id — null, выбор по виду идёт в нужный резолвер', () => {
    expect(schemaMeta('nope')).toBeNull();
    expect(modeMeta('nope')).toBeNull();
    expect(patternMeta('schema', 'abandonment')).toEqual(
      schemaMeta('abandonment'),
    );
    expect(patternMeta('mode', 'vulnerable_child')).toEqual(
      modeMeta('vulnerable_child'),
    );
  });
});
