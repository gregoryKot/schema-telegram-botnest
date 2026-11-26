import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getHost } from '../../../shared/src/host';
import { useHostId } from '../host/useHostId';
import { sheetStackOf } from './historySheetStack';

/**
 * Кнопка «Назад» мессенджера (Telegram/MAX): видна, пока открыт хоть один
 * лист, по нажатию — шаг назад по истории. Закрыть лист сам себя заставит
 * useHistorySheet (запись исчезла из стека). В браузере кнопки нет — её роль
 * играет сам браузер, хук ничего не делает.
 */
export function useHostBackButton(): void {
  const navigate = useNavigate();
  const location = useLocation();
  const hostId = useHostId();
  const open = sheetStackOf(location.state).length > 0;

  useEffect(() => {
    if (hostId === 'web') return;
    getHost().backButton.setVisible(open);
  }, [hostId, open]);

  useEffect(() => {
    if (hostId === 'web') return;
    const { backButton } = getHost();
    const off = backButton.onClick(() => navigate(-1));
    return () => {
      off();
      backButton.setVisible(false);
    };
  }, [hostId, navigate]);
}
