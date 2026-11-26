// @vitest-environment jsdom
// Склейка оставшихся строк g4 (ревью вёрстки r7, зонд висячих слов стенда): название задания висело на коротком слове
// («…за 10 / дней», «в / детстве», «и / записать») в «Практиках», «Все цели» и «Заданиях»; подписи каталогов — «для /
// пяти», «и / кризисов»; вопрос шага «Мне плохо» — «не / удовлетворена?»; строки листа «Какие инструменты показывать» —
// «в / детстве», «и / разобраться», «её / вверх», «на / странице». Название задания — текст терапевта или клиента:
// glueSpaces (только пробелы, дефисы и тире его, без U+2011 и U+2060); остальное — наши строки: glue. Слова те же.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TaskRow } from './TaskRow';
import { CatalogsBlock } from './CatalogsBlock';
import { AllTasksOverlay } from '../today/AllTasksOverlay';
import { StepNeed } from '../../components/flashcard/FlashcardSteps';
import { CustomizeRow } from '../../components/customize/CustomizeRow';
import { ReorderHint } from '../../components/customize/ReorderHint';
import { ToolsCustomizeSheet } from '../../components/quickActions/ToolsCustomizeSheet';
import { plain } from '../../test-support/plainText';
import { readCss } from '../../styles/cssRules.test-helpers';
import type { UserTask } from '../../api';

vi.mock('../../api', () => ({ api: { trackEvent: vi.fn() } }));
afterEach(cleanup);

const TITLE = 'Письмо себе в детстве: какой-то разговор за 10 дней и записать, что-нибудь одно';
const task = (over: Partial<UserTask> = {}): UserTask =>
  ({ id: 1, type: 'custom', text: TITLE, done: null, assignedBy: 7, ...over }) as UserTask;
const text = (el: Element | null | undefined) => el?.textContent ?? '';

describe('название задания — glueSpaces: короткое слово не висит, дефисы клиента те же', () => {
  it('строка задания: «в детстве», «за 10 дней», «и записать» вместе; «какой-то», «что-нибудь» — обычный дефис', () => {
    const { container } = render(<TaskRow task={task()} mark cta="начать →" onOpen={vi.fn()} />);
    const title = text(container.querySelector('.cp-task-title'));
    for (const pair of ['в детстве', 'за 10 дней', 'и записать']) expect(title).toContain(pair);
    expect(title).toContain('какой-то');
    expect(title).toContain('что-нибудь');
    expect(title).not.toMatch(/[‑⁠]/);
    expect(plain(title)).toBe(TITLE);
  });

  it('«Выполнено» в «Все цели»: та же склейка названия', () => {
    const done = task({ id: 2, done: true, completedAt: '2026-11-09T10:00:00.000Z' });
    render(
      <MemoryRouter>
        <AllTasksOverlay title="Все цели" tasks={[]} taskHistory={[done]} onClose={vi.fn()} onOpen={vi.fn()} onComplete={vi.fn()} onAdd={vi.fn()} />
      </MemoryRouter>,
    );
    const past = text(document.querySelector('.sk-task.is-past .sk-task-text'));
    expect(past).toContain('в детстве');
    expect(past).not.toMatch(/[‑⁠]/);
  });

  it('CSS: у названия text-wrap: pretty — последнее слово не остаётся в строке одно', () => {
    const rule = readCss('client-practice.css').find((r) => r.media === '' && r.selectors.includes('.cp-task-title'));
    expect(rule?.body).toMatch(/text-wrap:\s*pretty/);
  });
});

describe('наши строки группы — glue', () => {
  it('подписи каталогов: «для пяти», «и кризисов» вместе', () => {
    const rows = [
      { id: 'practices', look: 'nourish' as const, label: 'Что питает', sub: 'Маленькие действия для пяти потребностей', onClick: vi.fn() },
      { id: 'plans', look: 'plan' as const, label: 'Планы', sub: 'Планы поддержки и кризисов', onClick: vi.fn() },
    ];
    const { container } = render(<CatalogsBlock rows={rows} />);
    const subs = [...container.querySelectorAll('.cp-task-body .ds-sub')].map(text);
    expect(subs[0]).toContain('для пяти');
    expect(subs[1]).toContain('и кризисов');
    expect(subs.map(plain)).toEqual(rows.map((r) => r.sub));
  });

  it('вопрос шага «Мне плохо»: «не удовлетворена?» вместе', () => {
    const { container } = render(
      <StepNeed needs={[]} selected={null} onPick={vi.fn()} stepIndex={2} total={4} onBack={vi.fn()} backLabel="Назад" />,
    );
    expect(text(container.querySelector('.sk-fc-ask'))).toContain('не удовлетворена?');
  });

  it('строка листа настройки: подписи склеены, имя тумблера — как есть', () => {
    const { container, getByRole } = render(
      <CustomizeRow title="Письмо себе в детстве" sub="Заметить и разобраться" on onToggle={vi.fn()} rowRef={() => {}} offsetY={0} lifted={false} />,
    );
    expect(text(container.querySelector('.cz-title'))).toBe('Письмо себе в детстве');
    expect(text(container.querySelector('.cz-sub'))).toBe('Заметить и разобраться');
    expect(getByRole('switch').getAttribute('aria-label')).toBe('Письмо себе в детстве');
  });

  it('подсказки листа: «её вверх» и «на странице» вместе', () => {
    const tr = (ty: string) => ty;
    const { container } = render(<ReorderHint tr={tr} phone noun="карточек" />);
    expect(text(container.querySelector('.cz-hint'))).toContain('её вверх');
    cleanup();
    const tools = { groups: [[], []], hidden: [], toggle: vi.fn(), onReorder: vi.fn(() => false as const) };
    render(<MemoryRouter><ToolsCustomizeSheet tools={tools as never} onClose={vi.fn()} /></MemoryRouter>);
    const hints = [...document.querySelectorAll('.cz-hint')].map(text);
    expect(hints.some((h) => h.includes('на странице'))).toBe(true);
  });
});
