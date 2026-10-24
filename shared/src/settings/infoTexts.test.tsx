// @vitest-environment jsdom
// Объясняющие листы настроек — общий текст для сайта и мини-аппа: обе формы
// обращения, жирные куски, отсутствие «ты» в форме «вы».
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { settingsInfoTexts, type InfoText } from './infoTexts';
import { InfoParts } from './InfoParts';
import { hasTyForms } from '../utils/tyFormsSweep';

afterEach(cleanup);

const tr = (form: 'ty' | 'vy') => (ty: string, vy: string) =>
  form === 'ty' ? ty : vy;
const plain = (t: InfoText) =>
  t.paragraphs
    .flatMap((p) => p.parts.map((x) => (typeof x === 'string' ? x : x.b)))
    .join('');

describe('settingsInfoTexts', () => {
  it('три листа с заголовками «Зачем …»', () => {
    const t = settingsInfoTexts(tr('ty'));
    expect(t.notify.title).toBe('Зачем уведомления');
    expect(t.pair.title).toBe('Зачем привязывать друга');
    expect(t.therapist.title).toBe('Зачем подключать терапевта');
  });

  it('форма «ты» и «вы» различаются там, где есть обращение', () => {
    expect(plain(settingsInfoTexts(tr('ty')).pair)).toMatch(/Ты и друг/);
    expect(plain(settingsInfoTexts(tr('vy')).pair)).toMatch(/Вы и друг/);
    expect(plain(settingsInfoTexts(tr('ty')).therapist)).toMatch(
      /Если ты работаешь/,
    );
    expect(plain(settingsInfoTexts(tr('vy')).therapist)).toMatch(
      /Если вы работаете/,
    );
  });

  it('в форме «вы» нет остаточных «ты»-форм', () => {
    const t = settingsInfoTexts(tr('vy'));
    for (const key of ['notify', 'pair', 'therapist'] as const) {
      expect(hasTyForms(plain(t[key]))).toBe(false);
    }
  });

  it('первый абзац каждого листа — главный (lead), остальные нет', () => {
    const t = settingsInfoTexts(tr('ty'));
    for (const key of ['notify', 'pair', 'therapist'] as const) {
      expect(t[key].paragraphs[0].lead).toBe(true);
      expect(t[key].paragraphs.slice(1).every((p) => !p.lead)).toBe(true);
    }
  });
});

describe('InfoParts', () => {
  it('строки выводит как есть, {b} — жирным с переданным классом', () => {
    const { container } = render(
      <p>
        <InfoParts
          parts={['до ', { b: 'важное' }, ' после']}
          boldClassName="strong"
        />
      </p>,
    );
    expect(container.textContent).toBe('до важное после');
    const b = container.querySelector('b');
    expect(b?.textContent).toBe('важное');
    expect(b?.className).toBe('strong');
  });
});
