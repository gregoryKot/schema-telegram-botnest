import { useTr } from '../../utils/addressForm';
import { useCopyToClipboard } from '../../../../shared/src/utils/useCopyToClipboard';
import { SSection } from './ui';
import { pairTexts } from '../../../../shared/src/pair/pairTexts';
import type { PairMechanics } from '../../../../shared/src/pair/usePairMechanics';
import { PartnerCard } from './PartnerCard';

// Раздел «Партнёр» — вынесен из SettingsSheet.tsx (правило №10). Состояние
// пары живёт в родителе (общий хук shared/src/pair/usePairMechanics), здесь
// только отображение; карточка с кодом после создания приглашения открывается
// через onInviteCreated хука (та же, что в мини-аппе, правило №3).
export function PartnerSection({ pair }: { pair: PairMechanics }) {
  const tr = useTr();
  const copy = useCopyToClipboard();
  const {
    data, loading, loadError, retryLoad, inviteUrl, joinCode, setJoinCode, joinView, setJoinView,
    joinError, leaveError, createError, confirmLeaveCode, setConfirmLeaveCode,
    handleCreateInvite, handleJoin, handleLeave,
  } = pair;
  const { copyLabel } = pairTexts(tr);

  return (
    <SSection id="s-partner" label="Партнёр" hint="Видите индексы дня друг друга — просто число, без деталей">
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
        ) : data.partners.length > 0 ? (
          data.partners.map(p => (
            <PartnerCard key={p.code} partner={p} confirmLeaveCode={confirmLeaveCode}
              setConfirmLeaveCode={setConfirmLeaveCode} onLeave={handleLeave} leaveError={leaveError} />
          ))
        ) : joinView === 'main' ? (
          <>
            <div className="st-actions">
              <button className="ds-btn ds-btn--sm" onClick={handleCreateInvite} disabled={loading}>
                {loading ? '...' : createError ? 'Не получилось — ещё раз' : data.pendingCode ? 'Новая ссылка' : 'Пригласить друга'}
              </button>
              <button className="ds-btn ds-btn--sm ds-btn--secondary" onClick={() => setJoinView('join')}>Ввести код</button>
            </div>
            {inviteUrl && (
              <div>
                <div className="st-text st-text--faint">{copyLabel}</div>
                <div className="st-mono st-mb10">{inviteUrl}</div>
                <button className={`ds-link${copy.copied ? ' is-ok' : copy.failed ? ' st-link-danger' : ''}`} onClick={() => void copy.copy(inviteUrl)}>
                  {copy.copied ? '✓ Скопировано' : copy.failed ? 'Не скопировалось — ссылка выше' : 'Скопировать ссылку'}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="st-body-block">
            <button className="ds-link" onClick={() => setJoinView('main')}>← Назад</button>
            <div className="st-actions">
              <input className={`ds-input st-grow st-code st-code--center${joinError ? ' st-input-err' : ''}`}
                value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} placeholder="Код" />
              <button className="ds-btn" onClick={() => void handleJoin()} disabled={!joinCode.trim() || loading}>Войти</button>
            </div>
            {joinError && <div className="st-err">Код не найден или уже использован</div>}
          </div>
        )}
      </div>
    </SSection>
  );
}
