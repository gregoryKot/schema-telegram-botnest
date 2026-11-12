import { useTr } from '../../utils/addressForm';
import { SSection } from './ui';
import { pairTexts } from '../../../../shared/src/pair/pairTexts';
import { pendingInviteUrl, canCreateInvite, inviteButtonLabel, freshInviteUrl } from '../../../../shared/src/pair/pairView';
import type { PairMechanics } from '../../../../shared/src/pair/usePairMechanics';
import { PartnerCard } from './PartnerCard';
import { PartnerInviteLink } from './PartnerInviteLink';
import { PendingInvite } from './PendingInvite';
import { joinConfirmExplain } from '../../../../shared/src/therapy/joinConfirmCopy';
import { SettingsInfoHelp } from './SettingsInfoHelp';

// Раздел «Партнёр» (из SettingsSheet.tsx, №10): состояние — хук shared/src/pair/usePairMechanics.
// Партнёров может быть несколько: «Позвать ещё одного» и ввод кода — и при подключённом.
// Объём доступа честный (индекс дня и неделя); ввод кода — то же согласие, что у
// ссылки (joinConfirmExplain); ждущее приглашение можно отменить.
export function PartnerSection({ pair }: { pair: PairMechanics }) {
  const tr = useTr();
  const {
    data, loading, loadError, retryLoad, inviteUrl, joinCode, setJoinCode, joinView, setJoinView,
    joinError, leaveError, createError, confirmLeaveCode, setConfirmLeaveCode,
    handleCreateInvite, handleJoin, handleLeave,
  } = pair;
  const { copyLabel, pendingLabel, scopeHint } = pairTexts(tr);
  const pendingUrl = data ? pendingInviteUrl(data) : '';
  const freshUrl = data ? freshInviteUrl(inviteUrl, data) : '';

  // «Позвать в пару» залита, пока пары нет; при паре или ждущей ссылке приглашение — второстепенное действие.
  const quietInvite = !!data && (data.partners.length > 0 || !!data.pendingCode);
  const actions = data && (
    <>
      {canCreateInvite(data) && (
        <button className={`ds-btn ds-btn--sm${quietInvite ? ' ds-btn--secondary' : ''}`} onClick={handleCreateInvite} disabled={loading}>
          {inviteButtonLabel({ loading, createError, hasPartners: data.partners.length > 0, hasPending: !!data.pendingCode })}
        </button>
      )}
      <button className="ds-btn ds-btn--sm ds-btn--secondary" onClick={() => setJoinView('join')}>Ввести код</button>
    </>
  );

  return (
    <SSection id="s-partner" label="Партнёр" help={<SettingsInfoHelp infoKey="pair" />} hint={scopeHint}>
      <div className="st-body-block">
        {!data && !loadError ? (
          <div className="st-text st-text--faint">Загрузка...</div>
        ) : !data ? (
          // Сбой getPair() не должен выглядеть как «нет партнёра»: подключённый
          // пользователь на сетевой ошибке увидел бы «пригласить друга».
          <div>
            <div className="st-err">Не удалось загрузить данные о партнёре</div>
            <button className="ds-link" onClick={retryLoad}>Повторить</button>
          </div>
        ) : joinView === 'join' ? (
          <div className="st-body-block">
            <button className="ds-link" onClick={() => setJoinView('main')}>← Назад</button>
            <p className="st-text" data-testid="pair-join-consent">{joinConfirmExplain(true, tr)}</p>
            <div className="st-actions">
              <input className={`ds-input st-grow st-code st-code--center${joinError ? ' st-input-err' : ''}`}
                value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} placeholder="Код" />
              <button className="ds-btn" onClick={() => void handleJoin()} disabled={!joinCode.trim() || loading}>Присоединиться</button>
            </div>
            {joinError && <div className="st-err">Код не найден или уже использован</div>}
          </div>
        ) : (
          <>
            {data.partners.map(p => (
              <PartnerCard key={p.code} partner={p} confirmLeaveCode={confirmLeaveCode}
                setConfirmLeaveCode={setConfirmLeaveCode} onLeave={handleLeave} leaveError={leaveError === p.code} />
            ))}
            {data.pendingCode
              ? <PendingInvite label={pendingLabel} url={pendingUrl} actions={actions} onCancel={() => void handleLeave(data.pendingCode!)} failed={leaveError === data.pendingCode} />
              : <div className="st-actions">{actions}</div>}
            {freshUrl && <PartnerInviteLink label={copyLabel} url={freshUrl} />}
          </>
        )}
      </div>
    </SSection>
  );
}
