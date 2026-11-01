import { BottomSheet } from './BottomSheet';
import { api, PairsData } from '../api';
import { useTr } from '../utils/addressForm';
import { logErr } from '../utils/logErr';
import { useJoinConfirm } from '../../../shared/src/therapy/useJoinConfirm';
import { useInvitePreview } from '../../../shared/src/therapy/useInvitePreview';
import {
  joinConfirmExplain,
  joinConfirmTitle,
} from '../../../shared/src/therapy/joinConfirmCopy';
import {
  inviteFromLine,
  inviteInvalidText,
  JOIN_DONE_TITLE,
  joinDoneText,
} from '../../../shared/src/therapy/therapistLinkCopy';

interface Props {
  joinKind: 'pair' | 'therapy';
  joinCode: string;
  onClose: () => void;
  onPairJoined: (data: PairsData) => void;
}

const titleStyle = {
  fontSize: 19,
  fontWeight: 700,
  color: 'var(--text)',
  marginBottom: 12,
} as const;
const textStyle = {
  fontSize: 15,
  color: 'var(--text)',
  lineHeight: 1.7,
  marginBottom: 20,
} as const;
const errStyle = {
  fontSize: 14,
  color: 'var(--accent-red)',
  lineHeight: 1.6,
  marginBottom: 16,
} as const;
const btn = (primary: boolean, busy = false) =>
  ({
    width: '100%',
    padding: primary ? '15px 0' : '13px 0',
    borderRadius: primary ? 'var(--r-14)' : 'var(--r-12)',
    border: 'none',
    background: primary ? 'var(--accent)' : 'rgba(var(--fg-rgb),0.08)',
    color: primary ? 'var(--on-accent)' : 'var(--text)',
    fontSize: 15,
    fontWeight: 600,
    cursor: busy ? 'default' : 'pointer',
    opacity: primary && busy ? 0.7 : 1,
    marginBottom: primary ? 10 : 0,
  }) as const;

// M1 (аудит 2026-08): экран-согласие перед присоединением по startParam.
// pair_/therapy_ из ссылки (?startapp=…) подконтрольны отправителю, а джойн —
// приватное действие с расшариванием данных (партнёр видит индекс дня и неделю;
// терапевт — клинику). Поэтому сетевой вызов идёт ТОЛЬКО после явного
// «Присоединиться». Закрытие любым способом (крестик/бэкдроп/назад/«не сейчас»)
// = отказ, api.join* не вызывается (fail-closed).
// Терапевт (инцидент 2026-10-26): до согласия видно, чей код (имя с сервера,
// без выдумки) и что код уже не действует; после — что теперь видит терапевт,
// вместо молча закрытой шторки. Пара — webapp/src/components/JoinConfirmSheet.tsx.
export function JoinConfirmSheet({
  joinKind,
  joinCode,
  onClose,
  onPairJoined,
}: Props) {
  const tr = useTr();
  const isPair = joinKind === 'pair';
  const preview = useInvitePreview(api.previewTherapyInvite, joinCode, !isPair);
  const name = preview.state === 'ok' ? preview.therapistName : null;
  const invalid = preview.state === 'invalid';

  const { busy, failMsg, confirm, done } = useJoinConfirm(
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
    () => {
      if (isPair) onClose();
    },
    logErr('joinConfirm'),
  );

  return (
    <BottomSheet onClose={onClose} zIndex={300}>
      <div style={{ padding: '4px 20px calc(24px + var(--safe-bottom))' }}>
        {done && !isPair ? (
          <>
            <div style={titleStyle}>{JOIN_DONE_TITLE}</div>
            <p role="status" style={textStyle}>
              {joinDoneText(name, tr)}
            </p>
            <button onClick={onClose} style={btn(true)}>
              Понятно
            </button>
          </>
        ) : (
          <>
            {/* Заголовок и объяснение («откуда и зачем», честный объём) — shared, общие с сайтом. */}
            <div style={titleStyle}>{joinConfirmTitle(isPair)}</div>
            {name && (
              <p style={{ ...textStyle, fontWeight: 600, marginBottom: 8 }}>
                {inviteFromLine(name)}
              </p>
            )}
            <p style={textStyle}>{joinConfirmExplain(isPair, tr)}</p>
            {invalid && (
              <p role="alert" style={errStyle}>
                {inviteInvalidText(tr)}
              </p>
            )}
            {failMsg && <p style={errStyle}>{failMsg}</p>}
            {!invalid && (
              <button onClick={confirm} disabled={busy} style={btn(true, busy)}>
                {busy ? 'Присоединяю…' : 'Присоединиться'}
              </button>
            )}
            <button onClick={onClose} disabled={busy} style={btn(false, busy)}>
              {invalid ? 'Закрыть' : 'Не сейчас'}
            </button>
          </>
        )}
      </div>
    </BottomSheet>
  );
}
