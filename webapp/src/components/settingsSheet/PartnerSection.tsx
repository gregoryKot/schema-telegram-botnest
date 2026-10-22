import { useTr } from '../../utils/addressForm';
import { SSection } from './ui';
import { pairTexts } from '../../../../shared/src/pair/pairTexts';
import { pendingInviteUrl, canCreateInvite, inviteButtonLabel, freshInviteUrl } from '../../../../shared/src/pair/pairView';
import type { PairMechanics } from '../../../../shared/src/pair/usePairMechanics';
import { PartnerCard } from './PartnerCard';
import { PartnerInviteLink } from './PartnerInviteLink';
import { SettingsInfoHelp } from './SettingsInfoHelp';

// Раздел «Партнёр» — вынесен из SettingsSheet.tsx (правило №10). Состояние
// пары живёт в родителе (общий хук shared/src/pair/usePairMechanics), здесь
// только отображение; карточка с кодом после создания приглашения открывается
// через onInviteCreated хука (та же, что в мини-аппе, правило №3).
// Как в мини-аппе (PairPanel): партнёров может быть несколько, поэтому
// «Пригласить ещё друга» и ввод кода доступны и при подключённом партнёре,
// а ждущее приглашение показывается ссылкой для повторной отправки.
export function PartnerSection({ pair }: { pair: PairMechanics }) {
  const tr = useTr();
  const {
    data, loading, loadError, retryLoad, inviteUrl, joinCode, setJoinCode, joinView, setJoinView,
    joinError, leaveError, createError, confirmLeaveCode, setConfirmLeaveCode,
    handleCreateInvite, handleJoin, handleLeave,
  } = pair;
  const { copyLabel, pendingLabel } = pairTexts(tr);
  const pendingUrl = data ? pendingInviteUrl(data) : '';
  const freshUrl = freshInviteUrl(inviteUrl, pendingUrl);

  return (
    <SSection id="s-partner" label="Партнёр" help={<SettingsInfoHelp infoKey="pair" />} hint="Видите индексы дня друг друга — просто число, без деталей">
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
            <div className="st-actions">
              <input className={`ds-input st-grow st-code st-code--center${joinError ? ' st-input-err' : ''}`}
                value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} placeholder="Код" />
              <button className="ds-btn" onClick={() => void handleJoin()} disabled={!joinCode.trim() || loading}>Войти</button>
            </div>
            {joinError && <div className="st-err">Код не найден или уже использован</div>}
          </div>
        ) : (
          <>
            {data.partners.map(p => (
              <PartnerCard key={p.code} partner={p} confirmLeaveCode={confirmLeaveCode}
                setConfirmLeaveCode={setConfirmLeaveCode} onLeave={handleLeave} leaveError={leaveError} />
            ))}
            {pendingUrl && <PartnerInviteLink label={pendingLabel} url={pendingUrl} />}
            <div className="st-actions">
              {canCreateInvite(data) && (
                <button className="ds-btn ds-btn--sm" onClick={handleCreateInvite} disabled={loading}>
                  {inviteButtonLabel({ loading, createError, hasPartners: data.partners.length > 0, hasPending: !!data.pendingCode })}
                </button>
              )}
              <button className="ds-btn ds-btn--sm ds-btn--secondary" onClick={() => setJoinView('join')}>Ввести код</button>
            </div>
            {freshUrl && <PartnerInviteLink label={copyLabel} url={freshUrl} />}
          </>
        )}
      </div>
    </SSection>
  );
}
