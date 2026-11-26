// @vitest-environment jsdom
// Шов «сервер посчитал → экран показал»: тело ответа merge/preview → parseMergePreview → сводка /account/merge.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AddressFormContext } from '../../utils/addressForm';
import { MergeSummary } from './MergeSummary';
import { parseMergePreview } from './useMergePreview';

afterEach(cleanup);

const BODY = { provider: 'google', otherDisplay: null, summary: { Rating: 12 }, combined: 0, twoFactorLost: false };

function renderFromServer(body: unknown, form: 'ty' | 'vy' = 'ty') {
  const parsed = parseMergePreview(body);
  if (!parsed) throw new Error('ответ сервера не разобрался');
  return render(
    <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
      <MergeSummary preview={{ kind: 'ok', ...parsed }} />
    </AddressFormContext.Provider>,
  );
}

describe('MergeSummary — что удалится без объединения', () => {
  it('сервер посчитал потери → строки до кнопки, без обещания «всё переедет»', () => {
    renderFromServer({ ...BODY, lost: { Rating: 3, YsqProgress: 1, AppActivity: 2 } });
    expect(screen.getByText(/не переедет и удалится – в твоём аккаунте уже есть такие же записи/)).toBeTruthy();
    expect(screen.getByText('3 оценки потребностей за те же дни')).toBeTruthy();
    expect(screen.getByText('незаконченный тест на схемы')).toBeTruthy();
    expect(screen.queryByText(/AppActivity/)).toBeNull();
    expect(screen.queryByText(/всё, что в нём записано/)).toBeNull();
    expect(screen.getByText(/записи из него переедут/)).toBeTruthy();
  });

  it('форма «вы» — «в вашем аккаунте»', () => {
    renderFromServer({ ...BODY, lost: { TherapistRequest: 1 } }, 'vy');
    expect(screen.getByText(/в вашем аккаунте уже есть такие же записи/)).toBeTruthy();
    expect(screen.getByText('заявка на роль терапевта')).toBeTruthy();
  });

  it('контроль: потерь нет или поля нет → блока нет, «всё переедет»', () => {
    for (const body of [BODY, { ...BODY, lost: {} }, { ...BODY, lost: { AppActivity: 4 } }]) {
      renderFromServer(body);
      expect(screen.queryByText(/не переедет и удалится/)).toBeNull();
      expect(screen.getByText(/всё, что в нём записано/)).toBeTruthy();
      cleanup();
    }
  });

  it('сводка не загрузилась — без обещания «всё переедет», общее предупреждение про дубли', () => {
    render(
      <AddressFormContext.Provider value={{ form: 'ty', setForm: vi.fn() }}>
        <MergeSummary preview={{ kind: 'failed' }} />
      </AddressFormContext.Provider>,
    );
    expect(screen.queryByText(/всё, что в нём записано/)).toBeNull();
    expect(screen.getByText(/записи из него переедут/)).toBeTruthy();
    expect(screen.getByText(/останутся записи текущего аккаунта, а дубли из второго удалятся/)).toBeTruthy();
  });
});
