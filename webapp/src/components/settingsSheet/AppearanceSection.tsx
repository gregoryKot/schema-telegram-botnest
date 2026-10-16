import { useState } from 'react';
import { useTr } from '../../utils/addressForm';
import { useReducedMotionPref } from '../../hooks/useReducedMotionPref';
import { SHead, SRow, Toggle } from './ui';

interface Props {
  userRole?: 'CLIENT' | 'THERAPIST';
  therapistMode?: boolean;
  onToggleTherapistMode?: () => void;
  onResignTherapist?: () => Promise<void> | void;
  onSaved: () => void;
}

// Раздел «Оформление» — вынесен из SettingsSheet.tsx (правило №10). Тумблера
// темы здесь больше нет: кабинет только светлый (редизайн 2026-10), тема
// переключается только на лендинге. Подтверждение снятия роли специалиста
// живёт внутри секции; «Сохранено ✓» после переключения
// «Меньше движения» — общий тост в шапке родителя, поэтому единственное, что
// секция отдаёт наружу, — колбэк onSaved.
export function AppearanceSection({ userRole, therapistMode, onToggleTherapistMode, onResignTherapist, onSaved }: Props) {
  const tr = useTr();
  const motion = useReducedMotionPref(onSaved);
  const [resignConfirm, setResignConfirm] = useState(false);
  const [resignBusy, setResignBusy] = useState(false);

  return (
    <>
      <SHead id="s-appearance" label="Оформление" />
      {/* Нейроинклюзивность: сниженная анимация (WCAG 2.3.3) */}
      <SRow
        title="Меньше движения"
        sub={motion.sub}
        right={<Toggle on={motion.reduced} onClick={motion.toggle} />}
      />
      {userRole === 'THERAPIST' && onToggleTherapistMode && (
        <SRow
          title="Режим специалиста"
          sub={therapistMode ? 'Кабинет терапевта' : 'Режим клиента'}
          right={<Toggle on={!!therapistMode} onClick={onToggleTherapistMode} />}
        />
      )}
      {userRole === 'THERAPIST' && onResignTherapist && (
        !resignConfirm ? (
          <div style={{ padding: '10px 0' }}>
            <button onClick={() => setResignConfirm(true)}
              style={{ padding: '8px 14px', borderRadius: 'var(--r-10)', border: '1px solid rgba(var(--fg-rgb),0.12)', background: 'transparent', color: 'var(--text-sub)', fontSize: 13, cursor: 'pointer' }}>
              Перестать быть специалистом
            </button>
          </div>
        ) : (
          <div style={{ padding: '10px 0' }}>
            <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.5, marginBottom: 10 }}>
              {tr(
                'Роль специалиста будет снята: кабинет и доступ к данным клиентов пропадут. Свои данные не теряешь. Заявку можно подать заново.',
                'Роль специалиста будет снята: кабинет и доступ к данным клиентов пропадут. Свои данные не теряете. Заявку можно подать заново.',
              )}
            </div>
            <div className="u-row8">
              <button disabled={resignBusy} onClick={() => setResignConfirm(false)}
                style={{ padding: '8px 14px', borderRadius: 'var(--r-10)', border: '1px solid rgba(var(--fg-rgb),0.12)', background: 'transparent', color: 'var(--text-sub)', fontSize: 13, cursor: 'pointer' }}>
                Отмена
              </button>
              <button disabled={resignBusy}
                onClick={() => { setResignBusy(true); void (async () => { try { await onResignTherapist(); setResignConfirm(false); } finally { setResignBusy(false); } })(); }}
                style={{ padding: '8px 14px', borderRadius: 'var(--r-10)', border: 'none', background: 'var(--accent-red)', color: 'var(--on-accent-red)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {resignBusy ? '…' : 'Снять роль'}
              </button>
            </div>
          </div>
        )
      )}
    </>
  );
}
