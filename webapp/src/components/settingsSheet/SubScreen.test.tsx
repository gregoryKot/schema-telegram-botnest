// @vitest-environment jsdom
// Подэкран настроек — свой уровень истории и Escape (ревью b25): «Назад» браузера и Escape
// возвращают на главный вид листа, а не закрывают лист целиком; фокус — на «← Назад».
import { describe, it, expect, vi, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { SettingsSubScreen } from './SubScreen';

afterEach(cleanup);

function Sheet({ onSheetClose }: { onSheetClose: () => void }) {
  const goBack = useHistorySheet(onSheetClose);
  const navigate = useNavigate();
  const [sub, setSub] = useState(false);
  return (
    <div>
      <button onClick={() => navigate(-1)}>назад браузера</button>
      {sub ? (
        <SettingsSubScreen title="Время уведомления" badge={<span>статус</span>} onClose={() => setSub(false)}>
          {(done) => <button onClick={done}>09:00</button>}
        </SettingsSubScreen>
      ) : (
        <><button onClick={() => goBack()}>← Закрыть</button><button onClick={() => setSub(true)}>Время</button></>
      )}
    </div>
  );
}

async function openSub() {
  const onSheetClose = vi.fn();
  render(<MemoryRouter><Sheet onSheetClose={onSheetClose} /></MemoryRouter>);
  fireEvent.click(screen.getByText('Время'));
  await screen.findByRole('heading', { name: 'Время уведомления' });
  return onSheetClose;
}
const backOnMain = () => waitFor(() => expect(screen.getByText('← Закрыть')).toBeTruthy());

describe('SettingsSubScreen — уровень поверх листа', () => {
  it('диалог с именем по заголовку, фокус на «← Назад», статус сохранения в шапке', async () => {
    await openSub();
    const level = screen.getByRole('dialog', { name: 'Время уведомления' });
    expect(level.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '← Назад' }));
    expect(screen.getByText('статус')).toBeTruthy();
  });

  it('Escape возвращает на главный вид, лист остаётся открыт', async () => {
    const onSheetClose = await openSub();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    await backOnMain();
    expect(screen.queryByText('Время уведомления')).toBeNull();
    expect(onSheetClose).not.toHaveBeenCalled();
  });

  it('«Назад» браузера возвращает на главный вид, лист остаётся открыт', async () => {
    const onSheetClose = await openSub();
    fireEvent.click(screen.getByText('назад браузера'));
    await backOnMain();
    expect(onSheetClose).not.toHaveBeenCalled();
  });

  it('«← Назад» и выбор варианта (done) идут тем же путём; второй «Назад» закрывает уже лист', async () => {
    const onSheetClose = await openSub();
    fireEvent.click(screen.getByRole('button', { name: '← Назад' }));
    await backOnMain();
    fireEvent.click(screen.getByText('Время'));
    fireEvent.click(await screen.findByText('09:00'));
    await backOnMain();
    expect(onSheetClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('назад браузера'));
    await waitFor(() => expect(onSheetClose).toHaveBeenCalledTimes(1));
  });
});
