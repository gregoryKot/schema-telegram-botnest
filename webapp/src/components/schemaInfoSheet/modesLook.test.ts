import { describe, it, expect } from 'vitest';
import { buildModeCheckin, buildModes } from './data';
import { checkinLook, checkinTiles, libraryGroupLook } from './modesLook';

const tr = (ty: string) => ty;

describe('libraryGroupLook — бумага и знаки групп справочника', () => {
  const looks = Object.fromEntries(buildModes(tr).map((g) => [g.group, libraryGroupLook(g)]));

  it('у группы одного вида — один знак группы на её бумаге', () => {
    expect(looks['Детские режимы']).toEqual({ hue: 28, signs: ['child_care'] });
    expect(looks['Критикующие режимы']).toEqual({ hue: 310, signs: ['looming'] });
    expect(looks['Здоровые режимы']).toEqual({ hue: 145, signs: ['together'] });
  });

  it('копинги — три стиля, три знака по порядку строк, бумага копингов', () => {
    expect(looks['Дисфункциональные копинги']).toEqual({ hue: 240, signs: ['yield', 'shelter', 'shield'] });
  });

  it('соседние группы — разной бумаги', () => {
    const hues = buildModes(tr).map((g) => libraryGroupLook(g).hue);
    hues.slice(1).forEach((h, i) => expect(h).not.toBe(hues[i]));
  });
});

describe('checkinLook — плитка чек-ина', () => {
  const items = buildModeCheckin(tr);
  const by = (label: string) => checkinLook(items.find((i) => i.label === label)!);

  it('режим берёт бумагу и знак своей группы', () => {
    expect(by('Одиноко / страшно')).toEqual({ hue: 28, sign: 'child_care' });
    expect(by('Хочу отключиться')).toEqual({ hue: 240, sign: 'shelter' });
    expect(by('Соглашаюсь, хотя не хочу')).toEqual({ hue: 240, sign: 'yield' });
    expect(by('Доказываю, что я лучше')).toEqual({ hue: 240, sign: 'shield' });
    expect(by('Держу всё под контролем')).toEqual({ hue: 240, sign: 'shield' });
    expect(by('Спокойно и устойчиво')).toEqual({ hue: 145, sign: 'together' });
  });

  it('«Сердитый Ребёнок» — свой знак Flare на бумаге детских режимов (решение 6)', () => {
    expect(by('Злюсь / несправедливо')).toEqual({ hue: 28, sign: 'flare' });
  });

  it('у каждой плитки есть знак', () => {
    items.forEach((i) => expect(checkinLook(i).sign).toBeTruthy());
  });
});

describe('checkinTiles — знак у первой плитки серии', () => {
  const tiles = checkinTiles(buildModeCheckin(tr));
  const sign = (label: string) => tiles.find((t) => t.item.label === label)!.sign;

  it('три Критика и три здоровых режима подряд — знак только у первой плитки серии, бумага у всех', () => {
    expect([sign('Давление / «надо больше»'), sign('Стыдно / со мной что-то не так'), sign('Вина / долг перед всеми')]).toEqual(['looming', null, null]);
    expect([sign('Поддерживаю себя'), sign('Легко и радостно'), sign('Спокойно и устойчиво')]).toEqual(['together', null, null]);
    expect(tiles.every((t) => t.hue === checkinLook(t.item).hue)).toBe(true);
  });

  it('свой знак и разные знаки соседей остаются: Flare рядом с ChildCare, три копинга — три знака', () => {
    expect([sign('Одиноко / страшно'), sign('Злюсь / несправедливо')]).toEqual(['child_care', 'flare']);
    expect([sign('Хочу отключиться'), sign('Соглашаюсь, хотя не хочу'), sign('Доказываю, что я лучше')]).toEqual(['shelter', 'yield', 'shield']);
  });

  it('гиперкомпенсация — два режима: Самовозвеличиватель и Гиперконтролёр, знак у первого', () => {
    const over = tiles.filter((t) => t.item.group === 'coping_overcompensation');
    expect(over.map((t) => [t.item.mode, t.sign])).toEqual([['Самовозвеличиватель', 'shield'], ['Гиперконтролёр', null]]);
  });
});
