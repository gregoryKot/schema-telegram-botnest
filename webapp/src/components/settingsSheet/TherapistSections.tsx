import { api } from '../../api';
import type { UserSettings } from '../../api';
import { FormerTherapistNote } from '../../../../shared/src/therapy/FormerTherapistNote';
import { useTr } from '../../utils/addressForm';
import { SSection, SRow, SmallToggle } from './ui';
import type { useTherapyRelationSettings } from './useTherapyRelationSettings';
import { SettingsInfoHelp } from './SettingsInfoHelp';

type Relation = ReturnType<typeof useTherapyRelationSettings>;

// Раздел «Мой терапевт» (клиент): подключение по коду или управление доступом.
export function MyTherapistSection({ rel, settings, patch }: {
  rel: Relation; settings: UserSettings; patch: (u: Partial<UserSettings>) => Promise<void>;
}) {
  const tr = useTr();
  const { therapyRelation, therapyJoinCode, setTherapyJoinCode, therapyJoinError, leaveTherapyError, leaveTherapy, joinTherapy } = rel;
  return (
    <SSection id="s-therapist" label="Мой терапевт" help={<SettingsInfoHelp infoKey="therapist" />} hint={tr('Терапевт видит трекер и задания. Остальное — на твоё усмотрение.', 'Терапевт видит трекер и задания. Остальное — на ваше усмотрение.')}>
      {therapyRelation === undefined ? (
        <SRow title="Загрузка..." />
      ) : therapyRelation?.status === 'active' ? (
        <div className="st-body-block">
          <div className="ds-h3">{therapyRelation.partnerName ?? 'Терапевт'} подключён</div>
          <div>
            <SRow title="Карточки схем и режимов" sub="Личные карточки и заметки" right={<SmallToggle label="Карточки схем и режимов" on={!!settings.therapistShareCards} onClick={() => patch({ therapistShareCards: !settings.therapistShareCards })} />} />
            <SRow title="Профиль и схемы" sub="Активные схемы и результаты теста" right={<SmallToggle label="Профиль и схемы" on={!!settings.therapistShareProfile} onClick={() => patch({ therapistShareProfile: !settings.therapistShareProfile })} />} />
          </div>
          <button className="ds-link st-link-danger" onClick={leaveTherapy}>Отключиться от терапевта</button>
          {leaveTherapyError && <div className="st-err">{tr('Не удалось отключиться. Проверь связь и попробуй ещё раз', 'Не удалось отключиться. Проверьте связь и попробуйте ещё раз')}</div>}
        </div>
      ) : (
        <div className="st-body-block">
          <FormerTherapistNote load={api.getFormerTherapist} enabled={therapyRelation === null} />
          <p className="st-text">
            {tr('Если терапевт выслал ссылку-приглашение — введи код ниже.', 'Если терапевт выслал ссылку-приглашение — введите код ниже.')}
          </p>
          <p className="st-text st-text--faint">
            Ввод кода — это согласие открыть терапевту доступ к своим записям:
            дневникам, заметкам и результатам опросников (объём настраивается после
            подключения, отключить терапевта можно в любой момент).
          </p>
          <div className="st-actions">
            <input className={`ds-input st-grow st-code${therapyJoinError ? ' st-input-err' : ''}`}
              value={therapyJoinCode} onChange={e => setTherapyJoinCode(e.target.value.toUpperCase())}
              placeholder="ABCDEF" maxLength={8} />
            <button className="ds-btn" onClick={joinTherapy}>Войти</button>
          </div>
          {therapyJoinError && <div className="st-err">{therapyJoinError}</div>}
        </div>
      )}
    </SSection>
  );
}

// Раздел «Кабинет терапевта» (специалист).
export function CabinetSection({ rel, onOpenTherapistCabinet }: { rel: Relation; onOpenTherapistCabinet?: () => void }) {
  const tr = useTr();
  const { createInvite, therapyInviteUrl, inviteCopied, inviteError } = rel;
  return (
    <SSection id="s-cabinet" label="Кабинет терапевта">
      <SRow title="Открыть кабинет" sub="Клиенты, задания, приглашения" onClick={onOpenTherapistCabinet} />
      <div className="st-body-block">
        <div className="st-actions">
          <button className="ds-btn ds-btn--sm ds-btn--secondary" onClick={createInvite}>+ Создать приглашение клиенту</button>
        </div>
        {/* Раньше «Скопировано ✓» показывалось всегда, даже если navigator.clipboard упал — теперь только при реальном успехе, иначе видна ссылка для ручного копирования. */}
        {therapyInviteUrl && <div className="st-text st-text--faint st-mono">{inviteCopied ? 'Скопировано ✓' : therapyInviteUrl}</div>}
        {inviteError && <div className="st-err">{tr('Не удалось создать приглашение. Попробуй ещё раз', 'Не удалось создать приглашение. Попробуйте ещё раз')}</div>}
      </div>
    </SSection>
  );
}
