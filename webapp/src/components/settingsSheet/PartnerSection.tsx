import { useTr } from '../../utils/addressForm';
import { useCopyToClipboard } from '../../../../shared/src/utils/useCopyToClipboard';
import { SSection } from './ui';
import type { usePairSettings } from './usePairSettings';

type Pair = ReturnType<typeof usePairSettings>;

// Раздел «Партнёр» — вынесен из SettingsSheet.tsx (правило №10). Состояние
// пары живёт в родителе (хук), здесь только отображение и обработчики.
export function PartnerSection({ pair, onInviteCreated }: {
  pair: Pair; onInviteCreated: (r: { code: string; url: string }) => void;
}) {
  const tr = useTr();
  const copy = useCopyToClipboard();
  const {
    pairData, pairLoading, pairLoadError, pairInviteUrl, joinCode, setJoinCode, joinView, setJoinView,
    joinError, leaveError, handleCreateInvite, handleJoin, leavePair, retryLoad,
  } = pair;
  // Карточка с кодом — та же, что в мини-аппе (правило №3): превью и шаринг картинкой.
  async function createInviteAndShare() {
    const r = await handleCreateInvite();
    if (r) onInviteCreated(r);
  }

  return (
    <SSection id="s-partner" label="Партнёр" hint="Видите индексы дня друг друга — просто число, без деталей">
      <div className="st-body-block">
        {pairLoading && !pairData ? (
          <div className="st-text st-text--faint">Загрузка...</div>
        ) : pairLoadError && !pairData ? (
          // Раньше сбой getPair() молча падал в "нет партнёра", и подключённый
          // пользователь на сетевой ошибке видел "пригласить друга".
          <div>
            <div className="st-err">{tr('Не удалось загрузить данные о партнёре', 'Не удалось загрузить данные о партнёре')}</div>
            <button className="ds-link" onClick={retryLoad}>Повторить</button>
          </div>
        ) : pairData && pairData.partners.length > 0 ? (
          pairData.partners.map(p => (
            <div key={p.code} className="st-body-block">
              <div className="st-text">{p.partnerName ?? 'Друг'} сегодня</div>
              {p.partnerTodayDone && p.partnerIndex !== null
                ? <div className="st-pair-num">{(p.partnerIndex ?? 0).toFixed(1)}<small>/10</small></div>
                : <div className="st-text">Ещё не заполнил</div>
              }
              <button className="ds-link st-link-danger" onClick={() => leavePair(p.code)}>Выйти из пары</button>
              {leaveError && <div className="st-err">{tr('Не удалось выйти из пары. Попробуй ещё раз', 'Не удалось выйти из пары. Попробуйте ещё раз')}</div>}
            </div>
          ))
        ) : joinView === 'main' ? (
          <>
            <div className="st-actions">
              <button className="ds-btn ds-btn--sm" onClick={createInviteAndShare} disabled={pairLoading}>
                {pairLoading ? '...' : pairData?.pendingCode ? 'Новая ссылка' : 'Пригласить друга'}
              </button>
              <button className="ds-btn ds-btn--sm ds-btn--secondary" onClick={() => setJoinView('join')}>Ввести код</button>
            </div>
            {pairInviteUrl && (
              <div>
                <div className="st-text st-text--faint">{tr('Отправь другу:', 'Отправьте другу:')}</div>
                <div className="st-mono st-mb10">{pairInviteUrl}</div>
                <button className={`ds-link${copy.copied ? ' is-ok' : copy.failed ? ' st-link-danger' : ''}`} onClick={() => void copy.copy(pairInviteUrl)}>
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
              <button className="ds-btn" onClick={handleJoin} disabled={!joinCode.trim() || pairLoading}>Войти</button>
            </div>
            {joinError && <div className="st-err">Код не найден или уже использован</div>}
          </div>
        )}
      </div>
    </SSection>
  );
}
