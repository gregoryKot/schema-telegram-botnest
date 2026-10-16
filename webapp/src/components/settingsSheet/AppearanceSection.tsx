import { useState } from 'react';
import { useTr } from '../../utils/addressForm';
import { useReducedMotionPref } from '../../hooks/useReducedMotionPref';
import { SSection, SRow, Toggle } from './ui';

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
    <SSection id="s-appearance" label="Оформление">
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
          <div className="st-body-block">
            <div className="st-actions">
              <button className="ds-btn ds-btn--sm ds-btn--secondary" onClick={() => setResignConfirm(true)}>
                Перестать быть специалистом
              </button>
            </div>
          </div>
        ) : (
          <div className="st-body-block">
            <div className="st-text">
              {tr(
                'Роль специалиста будет снята: кабинет и доступ к данным клиентов пропадут. Свои данные не теряешь. Заявку можно подать заново.',
                'Роль специалиста будет снята: кабинет и доступ к данным клиентов пропадут. Свои данные не теряете. Заявку можно подать заново.',
              )}
            </div>
            <div className="st-actions">
              <button className="ds-btn ds-btn--sm ds-btn--secondary" disabled={resignBusy} onClick={() => setResignConfirm(false)}>
                Отмена
              </button>
              <button className="ds-btn ds-btn--sm st-btn-danger is-solid" disabled={resignBusy}
                onClick={() => { setResignBusy(true); void (async () => { try { await onResignTherapist(); setResignConfirm(false); } finally { setResignBusy(false); } })(); }}>
                {resignBusy ? '…' : 'Снять роль'}
              </button>
            </div>
          </div>
        )
      )}
    </SSection>
  );
}
