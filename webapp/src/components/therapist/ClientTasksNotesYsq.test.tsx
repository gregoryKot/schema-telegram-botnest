// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ClientTasksTab } from './ClientTasksTab';
import { ClientNotesTab } from './ClientNotesTab';
import { ClientYSQTab } from './ClientYSQTab';
import { KanbanView } from './KanbanView';
import type { ClientData, TherapyClientSummary, UserTask } from '../../api';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PHONE_MEDIA } from '../../utils/phoneLayout';
import type { ClientDetail } from './clientSheetTypes';

afterEach(cleanup);

const task = (id: number, over: Record<string, unknown>) => ({
  id, userId: 1, assignedBy: 2, type: 'custom', text: `задание ${id}`, targetDays: null, needId: null,
  dueDate: null, done: null, completedAt: null, createdAt: '2026-10-01T10:00:00Z', ...over,
});

describe('ClientTasksTab', () => {
  it('считает активные, склоняет подпись', () => {
    const detail = { clientTasks: [task(1, {}), task(2, {}), task(3, { done: true, completedAt: '2026-10-05T10:00:00Z' })] };
    render(<ClientTasksTab detail={detail as unknown as ClientDetail} onAssign={vi.fn()} />);
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('активных домашних задания')).toBeTruthy();
    expect(screen.getByText('Выполнено')).toBeTruthy();
  });

  // QA 2026-10-26: все четыре шаблона открывали лист с «Трекером потребностей».
  it('шаблон открывает назначение со своим типом и текстом', () => {
    const onAssign = vi.fn();
    render(<ClientTasksTab detail={{ clientTasks: [], selectedClient: { telegramId: 7 } } as unknown as ClientDetail} onAssign={onAssign} />);
    fireEvent.click(screen.getByText('Письмо себе в детстве'));
    expect(onAssign).toHaveBeenLastCalledWith({ type: 'letter_to_self' });
    fireEvent.click(screen.getByText('Дневник режима'));
    expect(onAssign).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'custom', text: expect.stringContaining('Дневник режима') }));
    fireEvent.click(screen.getByText('+ Назначить'));
    expect(onAssign).toHaveBeenLastCalledWith();
    expect(screen.queryByText('Imagery rescripting')).toBeNull();
  });

  it('офлайн-клиенту — без шаблонов упражнений, с объяснением', () => {
    render(<ClientTasksTab detail={{ clientTasks: [], selectedClient: { telegramId: -3 } } as unknown as ClientDetail} onAssign={vi.fn()} />);
    expect(screen.queryByText('Назначить из шаблона')).toBeNull();
    expect(screen.getByText(/Клиент не пользуется приложением/)).toBeTruthy();
  });

  // QA 2026-11: квадрат 22×22 с рамкой акцента слева выглядел чекбоксом, но
  // на нажатие не отвечал — терапевт задание клиента не отмечает. Статус — один
  // бейдж ds-badge справа, нажимаемого на вид квадрата нет.
  it('статус задания — один бейдж ds-badge, квадрата-«чекбокса» нет', () => {
    const detail = { clientTasks: [task(1, {}), task(2, { done: true, completedAt: '2026-10-05T10:00:00Z' })], setShowAssign: vi.fn() };
    const { container } = render(<ClientTasksTab detail={detail as unknown as ClientDetail} />);
    expect(container.querySelector('.tb-check')).toBeNull();
    const rows = [...container.querySelectorAll('.tb-task')];
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.querySelectorAll('.ds-badge')).toHaveLength(1);
      expect(row.querySelector('[role="checkbox"], input[type="checkbox"]')).toBeNull();
      expect(row.firstElementChild?.className).toBe('pp-row-art'); // знак задания, дальше основной блок
      expect(row.querySelector('.tb-task-main')).not.toBeNull();
    }
    expect(rows.map(r => r.querySelector('.ds-badge')?.textContent)).toEqual(['В работе', 'Выполнено']);
  });

  // Регрессия: терапевт видел сырой id режима «invincible_oc» вместо
  // названия — вкладка рисовала task.text как есть.
  it('mode_intro — название режима, сырой id не виден', () => {
    const detail = { clientTasks: [task(1, { type: 'mode_intro', text: 'invincible_oc' })], setShowAssign: vi.fn() };
    render(<ClientTasksTab detail={detail as unknown as ClientDetail} onAssign={vi.fn()} />);
    expect(screen.getByText('Карточка режима: Неуязвимый Гиперконтролёр')).toBeTruthy();
    expect(screen.queryByText(/invincible_oc/)).toBeNull();
  });
});

// QA 2026-10-26: серия «Трекер 3 дн» просрочилась, бэкенд закрыл её
// (done=false). Доска показывала «Не вышло», а карточка — «1 активное … В
// работе». Теперь обе берут одну модель статусов (shared/tasks/taskStatus).
describe('ClientTasksTab — «не вышло» и прогресс серии', () => {
  it('закрытая серия — «Не вышло», в активные не считается, стоит после открытых', () => {
    const detail = {
      clientTasks: [
        task(1, { type: 'tracker_streak', text: 'Отмечать потребности 3 дня подряд', targetDays: 3, progress: 1, done: false, completedAt: '2026-10-05T12:00:00Z' }),
        task(2, { text: 'открытое' }),
      ],
      setShowAssign: vi.fn(),
    };
    render(<ClientTasksTab detail={detail as unknown as ClientDetail} onAssign={vi.fn()} />);
    expect(screen.getByText('активное домашнее задание')).toBeTruthy();
    expect(screen.getByText('Не вышло')).toBeTruthy();
    expect(screen.getByText('закрыто 5 окт · 1 из 3 дней')).toBeTruthy();
    const rows = screen.getAllByText(/открытое|Отмечать потребности/).map(n => n.textContent);
    expect(rows).toEqual(['открытое', 'Отмечать потребности 3 дня подряд']);
  });

  it('серия в работе — прогресс «1 из 7 дней», как у клиента «1/7»', () => {
    const detail = {
      clientTasks: [task(1, { type: 'diary_streak', text: 'Заполнять дневник 7 дней подряд', targetDays: 7, progress: 1 })],
      setShowAssign: vi.fn(),
    };
    render(<ClientTasksTab detail={detail as unknown as ClientDetail} onAssign={vi.fn()} />);
    expect(screen.getByText(/1 из 7 дней/)).toBeTruthy();
  });
});

describe('KanbanView — та же модель статусов', () => {
  it('«не вышло» в своей колонке, у выполненного — дата выполнения, просроченное помечено', () => {
    const allTasks = [{ clientId: 1, clientName: 'Анна', tasks: [
      task(1, { text: 'сделано', done: true, dueDate: '2026-10-20', completedAt: '2026-10-05T12:00:00Z' }),
      task(2, { text: 'не вышло', done: false, completedAt: '2026-10-06T12:00:00Z' }),
      task(3, { text: 'просрочено', dueDate: '2020-01-01' }),
    ] as UserTask[] }];
    render(<KanbanView allTasks={allTasks} loading={false} loadFailed={false} onRetry={vi.fn()} onOpenClient={vi.fn()} />);
    expect(screen.getByText('выполнено 5 окт')).toBeTruthy();
    expect(screen.queryByText('до 20 окт')).toBeNull();
    expect(screen.getByText('закрыто 6 окт')).toBeTruthy();
    expect(screen.getByText('Просрочено')).toBeTruthy();
  });
});

describe('KanbanView', () => {
  it('mode_intro — название режима, сырой id не виден', () => {
    const allTasks = [{ clientId: 1, clientName: 'Анна', tasks: [task(1, { type: 'mode_intro', text: 'invincible_oc' })] as UserTask[] }];
    render(<KanbanView allTasks={allTasks} loading={false} loadFailed={false} onRetry={vi.fn()} onOpenClient={vi.fn()} />);
    expect(screen.getByText('Карточка режима: Неуязвимый Гиперконтролёр')).toBeTruthy();
    expect(screen.queryByText(/invincible_oc/)).toBeNull();
  });
});

describe('ClientNotesTab', () => {
  it('фильтр по типу и раскрытие карточки с полями', () => {
    render(<ClientNotesTab
      clientDiary={[{ type: 'gratitude', date: '2026-10-02', excerpt: 'спасибо за день' }]}
      clientModeNotesData={[{ modeId: 'x', triggers: 'шум', feelings: '', thoughts: '', needs: '', behavior: '', origins: '', healthyView: '', modeFunction: '', needsMet: '' }]}
      clientSchemaNotesData={[]}
    />);
    expect(screen.getByText('спасибо за день')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: /Режимы/ }));
    expect(screen.queryByText('спасибо за день')).toBeNull();
    expect(screen.queryByText('шум')).toBeNull();
    fireEvent.click(screen.getByText('Режим-карточка'));
    expect(screen.getByText('шум')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: /Схемы/ }));
    expect(screen.getByText('В этой категории записей нет')).toBeTruthy();
  });
});

// #906: заголовков у вкладок карточки клиента нет ни на одной — имя уже во
// вкладке шапки (решение #902 для «Концептуализации» распространено на все);
// пустые состояния — общий ds-empty, а не свой курсив/центровка.
describe('вкладки без заголовков, пустые состояния — ds-empty (#906)', () => {
  it('«Записи клиента»: h2 для компьютера, рядом фильтр; пустая категория — ds-empty', () => {
    const { container } = render(<ClientNotesTab
      clientDiary={[{ type: 'gratitude', date: '2026-10-02', excerpt: 'спасибо за день' }]}
      clientModeNotesData={[]}
      clientSchemaNotesData={[]}
    />);
    // h2 в разметке (на ≥768 виден, на телефоне его прячет CSS); фильтр — в одной строке с ним
    const head = container.querySelector('.ds-page > .tb-notes-head')!;
    expect(head.children[0].querySelector('h2.tb-tab-h')?.textContent).toBe('Записи клиента');
    expect(head.children[0].classList.contains('tb-tab-title--desk')).toBe(true);
    expect(head.children[1].getAttribute('role')).toBe('tablist');
    fireEvent.click(screen.getByRole('tab', { name: /Схемы/ }));
    expect(screen.getByText('В этой категории записей нет').classList.contains('ds-empty')).toBe(true);
  });

  it('therapist-tabs.css: заголовок вкладки скрыт только под PHONE_MEDIA (≤767 и телефон в альбомной)', () => {
    const css = readFileSync(join(__dirname, '../../styles/therapist-tabs.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const at = css.indexOf(`@media ${PHONE_MEDIA}`);
    expect(at).toBeGreaterThan(-1);
    const phone = css.slice(at);
    expect(phone).toMatch(/\.tb-tab-h, \.tb-tab-title--desk \{ display: none; \}/);
    expect(phone).toMatch(/\.tb-notes-head \{ display: contents; \}/);
    expect(css.slice(0, at)).not.toMatch(/\.tb-(tab-h|tab-title--desk|notes-head)[^{]*\{[^}]*display/);
  });

  it('«Записи клиента» без единой записи — ds-empty', () => {
    render(<ClientNotesTab clientDiary={[]} clientModeNotesData={[]} clientSchemaNotesData={[]} />);
    expect(screen.getByText('Клиент ещё не заполнял дневник').classList.contains('ds-empty')).toBe(true);
  });

  it('YSQ с прохождениями: h2 «Тест на схемы» для компьютера, строка прохождений и действия остаются', () => {
    const run = { id: 1, completedAt: '2026-10-01T10:00:00Z', scores: [{ id: 'failure', pct5plus: 70 }] };
    const clientData = { ysqHistory: [run], ysqCompletedAt: '2026-10-01T10:00:00Z' } as unknown as ClientData;
    const selectedClient = { telegramId: 7 } as unknown as TherapyClientSummary;
    const { container } = render(<ClientYSQTab
      clientData={clientData} selectedClient={selectedClient} selfSchemaIds={[]} ysqSchemaIds={['failure']}
      ysqRequested={false} ysqError="" exportCopied={false} handleRequestYsq={vi.fn()} handleExport={vi.fn()}
    />);
    expect(container.querySelector('h2.tb-tab-h')?.textContent).toBe('Тест на схемы');
    // подпись видна и на телефоне: wrapper заголовка целиком не прячется
    expect(container.querySelector('.tb-tab-title')!.classList.contains('tb-tab-title--desk')).toBe(false);
    expect(screen.getByText(/1 прохождение · последнее/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Экспорт' })).toBeTruthy();
    expect(screen.queryByText(/экспортировать нечего/)).toBeNull();
  });

  it('YSQ с прохождениями, пустой концепт: «Экспорт» недоступен, причина строкой', () => {
    const run = { id: 1, completedAt: '2026-10-01T10:00:00Z', scores: [{ id: 'failure', pct5plus: 70 }] };
    const clientData = { ysqHistory: [run], ysqCompletedAt: '2026-10-01T10:00:00Z' } as unknown as ClientData;
    render(<ClientYSQTab
      clientData={clientData} selectedClient={{ telegramId: 7 } as unknown as TherapyClientSummary} selfSchemaIds={[]} ysqSchemaIds={[]}
      ysqRequested={false} ysqError="" exportCopied={false} exportEmpty handleRequestYsq={vi.fn()} handleExport={vi.fn()}
    />);
    expect((screen.getByRole('button', { name: 'Экспорт' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('В концепте пока пусто — экспортировать нечего')).toBeTruthy();
  });

  it('YSQ без прохождений: заголовок пустого состояния без засечного h2, кнопка запроса и чипы схем', () => {
    const selectedClient = { telegramId: 7 } as unknown as TherapyClientSummary;
    const { container } = render(<ClientYSQTab
      clientData={null} selectedClient={selectedClient} selfSchemaIds={['failure']} ysqSchemaIds={[]}
      ysqRequested={false} ysqError="" exportCopied={false} handleRequestYsq={vi.fn()} handleExport={vi.fn()}
    />);
    expect(screen.getByText('Тест на схемы ещё не пройден').classList.contains('ds-list-title')).toBe(true);
    expect(container.querySelector('.ds-h2')).toBeNull();
    expect(screen.getByText(/Запроси(те)? тест/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Запросить тест на схемы' })).toBeTruthy();
    expect(container.querySelector('.ds-chip.tone-tint')).not.toBeNull();
  });

  it('«Задания» без заданий — ds-empty', () => {
    render(<ClientTasksTab detail={{ clientTasks: [], setShowAssign: vi.fn() } as unknown as ClientDetail} />);
    expect(screen.getByText(/Нет назначенных заданий/).classList.contains('ds-empty')).toBe(true);
  });
});
