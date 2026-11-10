// @vitest-environment jsdom
// Текст записи в ленте «Записей» — слова самого пользователя (ревью g3 r5). Склейка glue вставляла в него
// неразрывный дефис U+2011 («кто-то») и связку U+2060 («3–5»): скопированная запись приходила с чужими
// знаками, поиск «кто-то» её не находил. Пользовательский текст — только пробелы (glueSpaces): дефисы и тире
// его, неразрывный пробел перед тире и после короткого слова остаётся. Через шов: карточка ленты (ModeEntry →
// EntryShell → EntryPreviewText) закрытая и раскрытая (EntryFields, вставка HealthyVoice).
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ModeEntry } from './EntryCards';
import type { ModeDiaryEntry } from '../../types';

afterEach(cleanup);

const SAID = 'Кто-то сказал — через 3–5 дней по-настоящему';
const ENTRY: ModeDiaryEntry = {
  id: 7,
  createdAt: new Date().toISOString(),
  modeId: 'vulnerable-child',
  situation: SAID,
  thoughts: 'Опять что-нибудь 4-4-6',
  healthyResponse: 'Я рядом — и это по-настоящему',
};
const JOINERS = /[\u2011\u2060]/;

describe('лента «Записей»: текст пользователя без чужих знаков', () => {
  it('закрытая карточка: дефис и тире как ввёл человек, пробел перед тире неразрывный', () => {
    const { container } = render(<ModeEntry entry={ENTRY} onDelete={() => {}} />);
    const text = container.textContent ?? '';
    expect(text).not.toMatch(JOINERS);
    expect(text).toContain('Кто-то сказал\u00a0— через 3–5 дней по-настоящему');
  });

  it('раскрытая карточка: поля и ответ Здорового Взрослого — те же знаки', () => {
    const { container } = render(<ModeEntry entry={ENTRY} onDelete={() => {}} />);
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    const text = container.textContent ?? '';
    expect(text).toContain('Опять что-нибудь 4-4-6');
    expect(text).toContain('Я\u00a0рядом\u00a0— и\u00a0это по-настоящему');
    expect(text).not.toMatch(JOINERS);
  });
});
