import { useState } from 'react';
import { BottomSheet } from './BottomSheet';
import { api, PairsData } from '../api';
import { useTr } from '../utils/addressForm';
import { logErr } from '../utils/logErr';

interface Props {
  joinKind: 'pair' | 'therapy';
  joinCode: string;
  onClose: () => void;
  onPairJoined: (data: PairsData) => void;
}

// M1 (аудит 2026-08): экран-согласие перед присоединением по startParam.
// pair_/therapy_ из ссылки (?startapp=…) подконтрольны отправителю, а джойн —
// приватное действие с расшариванием данных (партнёр видит индекс дня и неделю;
// терапевт — клинику). Поэтому сетевой вызов идёт ТОЛЬКО после явного
// «Присоединиться». Закрытие любым способом (крестик/бэкдроп/назад/«не сейчас»)
// = отказ, api.join* не вызывается (fail-closed).
export function JoinConfirmSheet({
  joinKind,
  joinCode,
  onClose,
  onPairJoined,
}: Props) {
  const tr = useTr();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const isPair = joinKind === 'pair';

  // Заголовок и подписи кнопок нейтральны (без ты/вы) — не разводим.
  const title = isPair ? 'Присоединиться к паре?' : 'Открыть доступ терапевту?';

  // «Откуда и зачем» + ЧЕСТНЫЙ объём: существующая копия занижала («только
  // число 0–10»), но партнёр видит ещё и неделю (PartnerCard). Для экрана
  // согласия занижать нельзя.
  const explain = isPair
    ? tr(
        'Пара — это взаимная видимость с другим человеком. Партнёр увидит твой индекс дня (число от 0 до 10) и как он менялся последнюю неделю. Ты увидишь его. Дневники, заметки и оценки по потребностям остаются только у тебя.',
        'Пара — это взаимная видимость с другим человеком. Партнёр увидит ваш индекс дня (число от 0 до 10) и как он менялся последнюю неделю. Вы увидите его. Дневники, заметки и оценки по потребностям остаются только у вас.',
      )
    : tr(
        'Код от терапевта — это согласие открыть ему доступ к твоим записям. Трекер потребностей и задания терапевт видит всегда; дневники, карточки схем и результаты опросников — по твоему выбору в настройках. Отключить терапевта можно в любой момент.',
        'Код от терапевта — это согласие открыть ему доступ к вашим записям. Трекер потребностей и задания терапевт видит всегда; дневники, карточки схем и результаты опросников — по вашему выбору в настройках. Отключить терапевта можно в любой момент.',
      );

  async function confirm() {
    setBusy(true);
    setFailed(false);
    try {
      if (isPair) {
        await api.joinPair(joinCode);
        const data = await api.getPair();
        onPairJoined(data);
      } else {
        await api.joinTherapy(joinCode);
      }
      onClose();
    } catch (e) {
      logErr('joinConfirm')(e);
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <BottomSheet onClose={onClose} zIndex={300}>
      <div style={{ padding: '4px 20px calc(24px + var(--safe-bottom))' }}>
        <div
          style={{
            fontSize: 19,
            fontWeight: 700,
            color: 'var(--text)',
            marginBottom: 12,
          }}
        >
          {title}
        </div>
        <p
          style={{
            fontSize: 15,
            color: 'var(--text)',
            lineHeight: 1.7,
            marginBottom: 20,
          }}
        >
          {explain}
        </p>
        {failed && (
          <p
            style={{
              fontSize: 14,
              color: 'var(--danger, #c0392b)',
              lineHeight: 1.6,
              marginBottom: 16,
            }}
          >
            {tr(
              'Не получилось присоединиться. Проверь ссылку и попробуй ещё раз.',
              'Не получилось присоединиться. Проверьте ссылку и попробуйте ещё раз.',
            )}
          </p>
        )}
        <button
          onClick={confirm}
          disabled={busy}
          style={{
            width: '100%',
            padding: '15px 0',
            borderRadius: 14,
            border: 'none',
            background: 'var(--accent)',
            color: '#fff',
            fontSize: 15,
            fontWeight: 600,
            cursor: busy ? 'default' : 'pointer',
            opacity: busy ? 0.7 : 1,
            marginBottom: 10,
          }}
        >
          {busy ? 'Присоединяю…' : 'Присоединиться'}
        </button>
        <button
          onClick={onClose}
          disabled={busy}
          style={{
            width: '100%',
            padding: '13px 0',
            borderRadius: 12,
            border: 'none',
            background: 'rgba(var(--fg-rgb),0.08)',
            color: 'var(--text)',
            fontSize: 15,
            fontWeight: 600,
            cursor: busy ? 'default' : 'pointer',
          }}
        >
          Не сейчас
        </button>
      </div>
    </BottomSheet>
  );
}
