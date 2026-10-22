import { BottomSheet } from './BottomSheet';
import { api, PairsData } from '../api';
import { useTr } from '../utils/addressForm';
import { logErr } from '../utils/logErr';
import { useJoinConfirm } from '../../../shared/src/therapy/useJoinConfirm';
import {
  joinConfirmExplain,
  joinConfirmTitle,
} from '../../../shared/src/therapy/joinConfirmCopy';

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
  const isPair = joinKind === 'pair';

  // Заголовок и объяснение («откуда и зачем», честный объём) — shared, общие с сайтом.
  const title = joinConfirmTitle(isPair);
  const explain = joinConfirmExplain(isPair, tr);

  const { busy, failMsg, confirm } = useJoinConfirm(
    isPair,
    tr,
    async () => {
      if (isPair) {
        await api.joinPair(joinCode);
        onPairJoined(await api.getPair());
      } else {
        await api.joinTherapy(joinCode);
      }
    },
    onClose,
    logErr('joinConfirm'),
  );

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
        {failMsg && (
          <p
            style={{
              fontSize: 14,
              color: 'var(--accent-red)',
              lineHeight: 1.6,
              marginBottom: 16,
            }}
          >
            {failMsg}
          </p>
        )}
        <button
          onClick={confirm}
          disabled={busy}
          style={{
            width: '100%',
            padding: '15px 0',
            borderRadius: 'var(--r-14)',
            border: 'none',
            background: 'var(--accent)',
            color: 'var(--on-accent)',
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
            borderRadius: 'var(--r-12)',
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
