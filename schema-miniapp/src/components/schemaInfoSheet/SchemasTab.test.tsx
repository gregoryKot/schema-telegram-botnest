// @vitest-environment jsdom
// SchemasTab — вкладка «Схемы» справочника. Проверяет: без highlight все
// домены свёрнуты (не заваливаем читателя 20 схемами сразу), клик по домену
// раскрывает его список, а highlight автоматически открывает домен нужной
// схемы и помечает её маркером «◀» — иначе пользователь, пришедший «узнать
// про эту схему», видит свёрнутый список и не понимает, куда смотреть.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SchemasTab } from './SchemasTab';

afterEach(() => {
  cleanup();
});

describe('SchemasTab — без highlight', () => {
  it('домены видны, но схемы внутри свёрнуты по умолчанию', () => {
    render(<SchemasTab />);
    expect(screen.getByText('Отчуждение и отвержение')).toBeTruthy();
    expect(screen.queryByText('Эмоциональная депривация')).toBeNull();
  });

  it('клик по домену раскрывает список его схем', () => {
    render(<SchemasTab />);
    fireEvent.click(screen.getByText('Отчуждение и отвержение'));
    expect(screen.getByText('Эмоциональная депривация')).toBeTruthy();
  });

  it('повторный клик сворачивает домен обратно', () => {
    render(<SchemasTab />);
    const header = screen.getByText('Отчуждение и отвержение');
    fireEvent.click(header);
    expect(screen.getByText('Эмоциональная депривация')).toBeTruthy();
    fireEvent.click(header);
    expect(screen.queryByText('Эмоциональная депривация')).toBeNull();
  });
});

describe('SchemasTab — с highlight', () => {
  it('открывает домен нужной схемы сразу, без клика', () => {
    render(<SchemasTab highlight="Покинутость / Нестабильность" />);
    expect(screen.getByText(/Покинутость \/ Нестабильность/)).toBeTruthy();
  });

  it('помечает выделенную схему маркером «◀»', () => {
    render(<SchemasTab highlight="Покинутость / Нестабильность" />);
    expect(screen.getByText('Покинутость / Нестабильность ◀')).toBeTruthy();
  });
});
