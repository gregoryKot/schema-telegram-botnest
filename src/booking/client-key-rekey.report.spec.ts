import { rekeyReport, type RekeyStats } from './client-key-rekey.report';

const base: RekeyStats = {
  moved: 0,
  dropped: 0,
  purged: 0,
  shared: [],
  stale: [],
};

describe('rekeyReport — служебное сообщение владельцу о переводе ключей', () => {
  it('пустое состояние: переносы и удаления без склеек — сообщать нечего', () => {
    expect(rekeyReport(base)).toBeNull();
    expect(rekeyReport({ ...base, moved: 5, purged: 2 })).toBeNull();
  });

  it('склейка ящиков: номера броней по возрастанию, без повторов', () => {
    const text = rekeyReport({ ...base, shared: [12, 5, 12] }) ?? '';
    expect(text).toContain('Ключи комнат клиентов пересчитаны');
    expect(text).toContain('в бронях №5, №12 —');
    expect(text).not.toContain('Прежняя ссылка');
  });

  it('прежняя комната снята с учёта: отдельная строка со своими номерами', () => {
    const text = rekeyReport({ ...base, shared: [1], stale: [9, 8] }) ?? '';
    expect(text).toContain('в бронях №1 —');
    expect(text).toContain('Прежняя ссылка — в бронях №8, №9.');
  });
});
