import { useEffect, useState } from 'react';
import { getHost } from '../../../shared/src/host';
import { installPageUrl } from '../../../shared/src/host/homeScreen';
import { authedFetch } from '../apiClient';
import { reportClientError } from '../api';

const REFRESH_BEFORE_EXPIRY_MS = 10_000;
/** Один перевыпуск на монтирование: дольше ~4 минут карточку не держат. */
const MAX_CHAIN = 2;

interface HandoffResponse {
  deviceCode: string;
  expiresIn: number;
}

interface Issued {
  code: string;
  expiresAt: number;
}

// Код — один на страницу: карточка «Сегодня», раздел настроек и /install
// делят его, а повторный заход, пока код жив, сервер не дёргает. Каждый
// запрос — строка в БД и одноразовая ссылка входа, лимит на ручке 10 в минуту.
let issued: Issued | null = null;
let inflight: Promise<Issued | null> | null = null;

const usable = (i: Issued | null, now: number): i is Issued =>
  !!i && i.expiresAt - now > REFRESH_BEFORE_EXPIRY_MS;

async function request(): Promise<Issued | null> {
  try {
    const res = await authedFetch('/api/auth/ticket/handoff', {
      method: 'POST',
      body: JSON.stringify({ hostId: getHost().id }),
    });
    // 429 — лимит ручки, не авария: страница откроется и без кода.
    if (res.status === 429) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as HandoffResponse;
    return { code: data.deviceCode, expiresAt: Date.now() + data.expiresIn * 1000 };
  } catch (err) {
    // Человеку ничего не показываем (страница установки откроется и без
    // кода), но обработанная авария не должна быть немой (правило №14).
    reportClientError({
      message: `install handoff: не получен код передачи сессии: ${err instanceof Error ? err.message : String(err)}`,
      section: 'install.handoff',
    });
    return null;
  }
}

function obtain(): Promise<Issued | null> {
  if (usable(issued, Date.now())) return Promise.resolve(issued);
  if (!inflight) {
    inflight = request().then((i) => {
      issued = i;
      inflight = null;
      return i;
    });
  }
  return inflight;
}

/** Только для тестов: сброс модульного кэша между кейсами. */
export function _resetInstallHandoffForTests(): void {
  issued = null;
  inflight = null;
}

/**
 * Адрес страницы установки с одноразовым кодом передачи сессии: внешний
 * браузер (куда уводит кнопка внутри мессенджера) обменяет код на сессию и
 * откроется уже под этим же аккаунтом. До ответа сервера и при ошибке адрес
 * без кода: страница тогда просто попросит войти. Код живёт ~2 минуты, поэтому
 * за 10 с до истечения запрашиваем новый — один раз.
 */
export function useInstallHandoff(): { href: string } {
  const [code, setCode] = useState<string | null>(() =>
    usable(issued, Date.now()) ? issued.code : null,
  );

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const chain = async (attempt: number) => {
      const i = await obtain();
      if (cancelled) return;
      setCode(i?.code ?? null);
      if (i && attempt < MAX_CHAIN) {
        const delay = Math.max(i.expiresAt - Date.now() - REFRESH_BEFORE_EXPIRY_MS, 0);
        timer = setTimeout(() => void chain(attempt + 1), delay);
      }
    };
    void chain(1);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  return { href: installPageUrl(code ?? undefined) };
}
