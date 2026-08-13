import { parseSourceSlug } from './start-source';

describe('parseSourceSlug', () => {
  it('src_<известный slug> — возвращает его как есть', () => {
    expect(parseSourceSlug('src_seed1')).toBe('seed1');
    expect(parseSourceSlug('src_seed2')).toBe('seed2');
    expect(parseSourceSlug('src_channel')).toBe('channel');
    expect(parseSourceSlug('src_therapist')).toBe('therapist');
  });

  it('неизвестный/мусорный slug — нормализуется в other (правило №7)', () => {
    expect(parseSourceSlug('src_черный_пиар')).toBe('other');
    expect(parseSourceSlug('src_!!!@@@')).toBe('other');
    expect(parseSourceSlug('src_' + 'a'.repeat(5000))).toBe('other');
  });

  it('регистр не важен — SEED1 и seed1 дают один и тот же источник', () => {
    expect(parseSourceSlug('src_SEED1')).toBe('seed1');
    expect(parseSourceSlug('src_Channel')).toBe('channel');
  });

  it('payload с другим префиксом (pair_) не трогается — null', () => {
    expect(parseSourceSlug('pair_ABC123')).toBeNull();
  });

  it('пустой/отсутствующий payload — null (событие не пишется вовсе)', () => {
    expect(parseSourceSlug(undefined)).toBeNull();
    expect(parseSourceSlug('')).toBeNull();
  });

  it('"src_" без хвоста — валидный формат ссылки без узнаваемого slug, other', () => {
    expect(parseSourceSlug('src_')).toBe('other');
  });

  it('явно other в самой ссылке — тоже other (валидное значение allow-list)', () => {
    expect(parseSourceSlug('src_other')).toBe('other');
  });
});
