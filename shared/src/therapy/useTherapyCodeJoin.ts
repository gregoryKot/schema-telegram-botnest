import { useState } from 'react';
import { useTr } from '../utils/addressForm';
import type { TherapyRelationInfo } from '../apiTypes';
import { normalizeTherapyCode } from './inviteCode';
import { joinTherapyErrorText } from './joinErrorText';

export interface CodeJoinApi {
  joinTherapy: (code: string) => Promise<unknown>;
  getTherapyRelation: () => Promise<TherapyRelationInfo | null>;
}

// Подключение к терапевту по коду в «Мой терапевт» — одна механика на сайт и
// мини-апп. До 2026-10-26 жила двумя копиями (хук настроек сайта и инлайн в
// TherapistClientSection мини-аппа), и копии разошлись: мини-апп на 409
// «уже есть терапевт» писал «Неверный код». Ввод чистится здесь же
// (inviteCode.ts): ссылка целиком, пробелы, строчные — сервер получает код.
// `joined` — подключение прошло в этой сессии экрана: секция показывает, что
// именно теперь видит терапевт, вместо молча сменившейся карточки.
export function useTherapyCodeJoin(
  api: CodeJoinApi,
  onJoined: (rel: TherapyRelationInfo | null) => void,
) {
  const tr = useTr();
  const [code, setRawCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [joined, setJoined] = useState(false);

  const setCode = (raw: string) => {
    setRawCode(normalizeTherapyCode(raw));
    setError('');
  };

  async function submit() {
    if (!code || busy) return;
    setBusy(true);
    setError('');
    try {
      await api.joinTherapy(code);
      const rel = await api.getTherapyRelation();
      setRawCode('');
      setJoined(true);
      onJoined(rel);
    } catch (e) {
      setError(
        joinTherapyErrorText(e, tr) ??
          tr(
            'Код не подошёл. Проверь его или попроси у терапевта новый',
            'Код не подошёл. Проверьте его или попросите у терапевта новый',
          ),
      );
    } finally {
      setBusy(false);
    }
  }

  return { code, setCode, error, busy, joined, submit };
}

export type TherapyCodeJoin = ReturnType<typeof useTherapyCodeJoin>;
