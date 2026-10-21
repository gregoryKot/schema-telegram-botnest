// @vitest-environment jsdom
// Новые куски мобильных «Паттернов»: шапка, сегмент, строки схем по доменам,
// сворачиваемая карта, строка теста.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SCHEMA_DOMAINS } from '../../schemaTherapyData';
import { PatternsHeader } from './PatternsHeader';
import { PatternsTabsBar } from './PatternsTabsBar';
import { MySchemasList } from './MySchemasList';
import { SchemaMapFold } from './SchemaMapFold';
import { YsqTestRow } from './YsqTestRow';

afterEach(cleanup);

const [a, b] = SCHEMA_DOMAINS[0].schemas;

describe('PatternsHeader', () => {
  it('телефон: «Паттерны», подпись, без надписи капсом; «Библиотека» открывает библиотеку', () => {
    const open = vi.fn();
    const customize = vi.fn();
    render(<PatternsHeader mobile onOpenLibrary={open} onCustomize={customize} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Паттерны');
    expect(screen.getByText('Привычные реакции родом из детства')).toBeTruthy();
    expect(screen.queryByText('Схема-терапия')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Библиотека' }));
    expect(open).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Настроить экран' }));
    expect(customize).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledTimes(1);
  });
  it('десктоп: надпись и «Мои паттерны», «Настроить экран» ссылкой', () => {
    const customize = vi.fn();
    render(<PatternsHeader mobile={false} onOpenLibrary={vi.fn()} onCustomize={customize} />);
    fireEvent.click(screen.getByRole('button', { name: 'Настроить экран' }));
    expect(customize).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Схема-терапия')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Мои паттерны');
  });
});

describe('PatternsTabsBar', () => {
  it('отмечает выбранную вкладку и сообщает о переключении', () => {
    const change = vi.fn();
    render(<PatternsTabsBar tab="modes" onChange={change} />);
    expect(screen.getByRole('tab', { name: 'Режимы' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Схемы' }).getAttribute('aria-selected')).toBe('false');
    fireEvent.click(screen.getByRole('tab', { name: 'Потребности' }));
    expect(change).toHaveBeenCalledWith('needs');
  });
});

describe('MySchemasList', () => {
  const base = { onAdd: vi.fn(), onOpenSchema: vi.fn() };
  it('группирует по доменам, показывает статус и частоту, открывает схему', () => {
    const open = vi.fn();
    render(<MySchemasList {...base} onOpenSchema={open} ids={[a.id, b.id]} statusFor={() => 'карточка пока пустая'} freq={{ [a.id]: 2 }} />);
    expect(screen.getByText(SCHEMA_DOMAINS[0].domain)).toBeTruthy();
    expect(screen.getAllByText('карточка пока пустая')).toHaveLength(2);
    expect(screen.getByText('2 дня')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(open).toHaveBeenCalledWith(a.id);
  });
  it('без статусов и частоты (ещё грузятся) — только названия; «+ Добавить схему» работает', () => {
    const add = vi.fn();
    render(<MySchemasList {...base} onAdd={add} ids={[a.id]} />);
    expect(screen.queryByText('карточка пока пустая')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '+ Добавить схему' }));
    expect(add).toHaveBeenCalledTimes(1);
  });
  it('пусто — одна кнопка добавления', () => {
    render(<MySchemasList {...base} ids={[]} />);
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });
});

describe('SchemaMapFold', () => {
  it('свёрнуто по умолчанию, раскрывается и сворачивается', () => {
    render(<SchemaMapFold label="Все 20 схем"><p>карта</p></SchemaMapFold>);
    const btn = screen.getByRole('button', { name: /Все 20 схем/ });
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('карта')).toBeNull();
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('карта')).toBeTruthy();
    fireEvent.click(btn);
    expect(screen.queryByText('карта')).toBeNull();
  });
});

describe('YsqTestRow', () => {
  it('рисует подпись и действие, кнопка запускает тест', () => {
    const start = vi.fn();
    render(<YsqTestRow progressAnswered={12} completedAt={null} onStart={start} />);
    expect(screen.getByText('Начат · отвечено 12 из 116')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
    expect(start).toHaveBeenCalledTimes(1);
  });
});
