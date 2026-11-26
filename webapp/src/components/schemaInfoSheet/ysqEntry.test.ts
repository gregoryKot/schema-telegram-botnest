import { describe, it, expect } from 'vitest';
import { ysqEntryTile } from './ysqEntry';

const ty = (a: string) => a;
const vy = (_: string, b: string) => b;

describe('ysqEntryTile — одна плитка входа в тест', () => {
  it('без прогресса и результата — пройти тест, подпись о длине', () => {
    expect(ysqEntryTile({ hasResult: false, hasProgress: false, requested: false }, ty))
      .toEqual({ title: 'Пройти тест на схемы', sub: '116 вопросов · ~10 минут' });
  });

  it('незаконченный тест — надпись, «Продолжить тест» и место остановки в форме человека', () => {
    expect(ysqEntryTile({ hasResult: false, hasProgress: true, requested: false }, ty)).toEqual({
      label: 'Незаконченный тест', title: 'Продолжить тест', sub: 'Нажми, чтобы продолжить с места остановки',
    });
    expect(ysqEntryTile({ hasResult: false, hasProgress: true, requested: false }, vy).sub)
      .toBe('Нажмите, чтобы продолжить с места остановки');
  });

  it('запрос терапевта важнее места остановки', () => {
    expect(ysqEntryTile({ hasResult: false, hasProgress: true, requested: true }, ty).sub)
      .toMatch(/^Терапевт просит пройти/);
  });

  it('есть результат — без надписи о незаконченном, даже если прогресс остался', () => {
    expect(ysqEntryTile({ hasResult: true, hasProgress: true, requested: false }, ty))
      .toEqual({ title: 'Мои результаты теста', sub: 'Посмотреть или пройти заново' });
  });
});
