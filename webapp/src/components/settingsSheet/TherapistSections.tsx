import { api } from '../../api';
import type { UserSettings } from '../../api';
import { FormerTherapistNote } from '../../../../shared/src/therapy/FormerTherapistNote';
import { InviteCodeBox } from '../../../../shared/src/therapy/InviteCodeBox';
import { THERAPY_INVITE_CODE_PLACEHOLDER, THERAPY_INVITE_INPUT_MAX } from '../../../../shared/src/therapy/inviteCode';
import { joinDoneText, leaveTherapyCopy, therapistConnectedTitle } from '../../../../shared/src/therapy/therapistLinkCopy';
import { useTr } from '../../utils/addressForm';
import { ConfirmDialog } from '../ConfirmDialog';
import { SSection, SRow, SmallToggle } from './ui';
import type { useTherapyRelationSettings } from './useTherapyRelationSettings';
import { SettingsInfoHelp } from './SettingsInfoHelp';

type Relation = ReturnType<typeof useTherapyRelationSettings>;

// Раздел «Мой терапевт» (клиент): подключение по коду или управление доступом.
// Инцидент 2026-10-26: поле пускало 8 знаков при коде из 12 (теперь предел с
// запасом под ссылку, ввод чистит общий хук), отключение шло одним тапом,
// статус «Анна Терапевт подключён» был мужским родом.
export function MyTherapistSection({ rel, settings, patch }: {
  rel: Relation; settings: UserSettings; patch: (u: Partial<UserSettings>) => Promise<void>;
}) {
  const tr = useTr();
  const { therapyRelation, join, leave } = rel;
  const leaveCopy = leaveTherapyCopy(tr);
  return (
    <SSection id="s-therapist" label="Мой терапевт" help={<SettingsInfoHelp infoKey="therapist" />} hint={tr('Терапевт видит трекер и задания. Остальное — на твоё усмотрение.', 'Терапевт видит трекер и задания. Остальное — на ваше усмотрение.')}>
      {therapyRelation === undefined ? (
        <SRow title="Загрузка..." />
      ) : therapyRelation?.status === 'active' ? (
        <div className="st-body-block">
          <div className="ds-h3">{therapistConnectedTitle(therapyRelation.partnerName)}</div>
          {join.joined && <p className="st-text" role="status">{joinDoneText(therapyRelation.partnerName, tr)}</p>}
          <div>
            <SRow title="Карточки схем и режимов" sub="Карточки, заметки и дневники" right={<SmallToggle label="Карточки схем и режимов" on={!!settings.therapistShareCards} onClick={() => patch({ therapistShareCards: !settings.therapistShareCards })} />} />
            <SRow title="Профиль и схемы" sub="Активные схемы и результаты теста" right={<SmallToggle label="Профиль и схемы" on={!!settings.therapistShareProfile} onClick={() => patch({ therapistShareProfile: !settings.therapistShareProfile })} />} />
          </div>
          <button className="ds-link st-link-danger" onClick={leave.ask}>{leaveCopy.button}</button>
          {leave.confirming && (
            <ConfirmDialog
              title={leaveCopy.title}
              message={leaveCopy.message}
              confirmLabel={leaveCopy.confirm}
              cancelLabel={leaveCopy.cancel}
              busyLabel={leaveCopy.busy}
              busy={leave.busy}
              error={leave.failed ? leaveCopy.error : undefined}
              onConfirm={() => void leave.confirm()}
              onCancel={leave.cancel}
            />
          )}
        </div>
      ) : (
        <div className="st-body-block">
          <FormerTherapistNote load={api.getFormerTherapist} enabled={therapyRelation === null} />
          <p className="st-text">
            {tr('Код или ссылку от терапевта вставь в поле ниже.', 'Код или ссылку от терапевта вставьте в поле ниже.')}
          </p>
          <p className="st-text st-text--faint">
            Ввод кода — это согласие открыть терапевту доступ к своим записям:
            дневникам, заметкам и результатам опросников (объём настраивается после
            подключения, отключить терапевта можно в любой момент).
          </p>
          <div className="st-actions">
            <input className={`ds-input st-grow st-code${join.error ? ' st-input-err' : ''}`}
              aria-label="Код от терапевта"
              value={join.code} onChange={e => join.setCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && void join.submit()}
              placeholder={THERAPY_INVITE_CODE_PLACEHOLDER} maxLength={THERAPY_INVITE_INPUT_MAX}
              autoComplete="off" autoCapitalize="characters" spellCheck={false} />
            <button className="ds-btn" onClick={() => void join.submit()} disabled={join.busy}>
              {join.busy ? 'Подключаю…' : 'Подключиться'}
            </button>
          </div>
          {join.error && <div className="st-err">{join.error}</div>}
        </div>
      )}
    </SSection>
  );
}

// Раздел «Кабинет терапевта» (специалист).
export function CabinetSection({ rel, onOpenTherapistCabinet }: { rel: Relation; onOpenTherapistCabinet?: () => void }) {
  const { createInvite, invite, inviteCopied, inviteError } = rel;
  return (
    <SSection id="s-cabinet" label="Кабинет терапевта">
      <SRow title="Открыть кабинет" sub="Клиенты, задания, приглашения" onClick={onOpenTherapistCabinet} />
      <div className="st-body-block">
        <div className="st-actions">
          <button className="ds-btn ds-btn--sm ds-btn--secondary" onClick={createInvite}>+ Создать приглашение клиенту</button>
        </div>
        {/* Раньше «Скопировано ✓» показывалось всегда, даже если navigator.clipboard упал — теперь только при реальном успехе, иначе видна ссылка для ручного копирования. */}
        {invite && <div className="st-text st-text--faint st-mono">{inviteCopied ? 'Ссылка скопирована ✓' : invite.url}</div>}
        {invite && <InviteCodeBox code={invite.code} />}
        {inviteError && <div className="st-err">{inviteError}</div>}
      </div>
    </SSection>
  );
}
