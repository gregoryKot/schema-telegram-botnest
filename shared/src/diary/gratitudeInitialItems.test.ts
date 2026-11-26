import { describe, it, expect } from 'vitest';
import { pickGratitudeInitialItems } from './gratitudeInitialItems';

describe('pickGratitudeInitialItems', () => {
  it('нет записи и нет черновика — три пустых поля', () => {
    expect(pickGratitudeInitialItems(null, null)).toEqual(['', '', '']);
    expect(pickGratitudeInitialItems(undefined, undefined)).toEqual([
      '',
      '',
      '',
    ]);
    expect(pickGratitudeInitialItems([], [])).toEqual(['', '', '']);
  });

  it('нет записи, есть черновик — черновик как есть', () => {
    expect(pickGratitudeInitialItems(null, ['чай', ''])).toEqual(['чай', '']);
  });

  it('запись пустая по смыслу (одни пробелы) — как её отсутствие', () => {
    expect(pickGratitudeInitialItems(['  ', ''], ['чай'])).toEqual(['чай']);
  });

  it('есть запись, черновик пуст — пункты записи и пустые поля до трёх', () => {
    expect(pickGratitudeInitialItems(['утро'], null)).toEqual(['утро', '', '']);
    expect(pickGratitudeInitialItems(['утро'], ['', '', ''])).toEqual([
      'утро',
      '',
      '',
    ]);
  });

  it('запись из трёх пунктов — без лишних пустых полей', () => {
    expect(pickGratitudeInitialItems(['а', 'б', 'в'], null)).toEqual([
      'а',
      'б',
      'в',
    ]);
  });

  it('новые пункты черновика дописываются в конец записи', () => {
    expect(pickGratitudeInitialItems(['утро'], ['вечер', ''])).toEqual([
      'утро',
      'вечер',
      '',
    ]);
  });

  it('пункты черновика, уже лежащие в записи, не дублируются', () => {
    expect(
      pickGratitudeInitialItems(['утро', 'кофе'], ['кофе ', 'вечер', 'вечер']),
    ).toEqual(['утро', 'кофе', 'вечер']);
  });

  it('не мутирует входные массивы', () => {
    const saved = ['утро'];
    const draft = ['вечер'];
    pickGratitudeInitialItems(saved, draft);
    expect(saved).toEqual(['утро']);
    expect(draft).toEqual(['вечер']);
  });
});
