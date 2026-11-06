import { buildPracticesIntro } from '../../../shared/src/onboarding/onboardingExplainers';
import { PRACTICE_TEXT_MAX } from '../../../shared/src/limits/textLimits';
import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import type { UserPractice } from '../api';
import { useAsyncData } from '../hooks/useAsyncData';
import { Loader } from './Loader';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { useConfirmTap } from '../../../shared/src/hooks/useConfirmTap';
import { useTimedFlag } from '../../../shared/src/hooks/useTimedFlag';
import { useTr } from '../utils/addressForm';
import { useNeedData } from '../needData';
import { pressable } from '../utils/a11y';
import { detectCrisisAny } from '../utils/crisisMarkers';
import { CrisisCard } from './CrisisCard';
import { PaperEmpty } from './art/PaperEmpty';
import { NEED_HUE, hueStyle } from '../lib/tone';
import { pluralRu } from '../../../shared/src/utils/pluralRu';
import type { NeedId } from '../../../shared/src/needs/types';
import '../styles/sheet-tasks.css';
const NEED_IDS = ['attachment', 'autonomy', 'expression', 'play', 'limits'];
const NEED_NAMES: Record<string, string> = {
  attachment: 'Привязанность', autonomy: 'Автономия',
  expression: 'Выражение чувств', play: 'Спонтанность', limits: 'Границы',
};

interface Props {
  onClose: () => void;
  onOpenTracker?: () => void;
}

export function PracticesScreen({ onClose, onOpenTracker }: Props) {
  const NEED_DATA = useNeedData();
  const tr = useTr();
  const goBack = useHistorySheet(onClose);
  const [needIdx, setNeedIdx] = useState(0);
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);
  // Тосты гаснут сами, таймер чистится на размонтировании (useTimedFlag).
  const [addedToast, flashAdded] = useTimedFlag(2000);
  const [errorToast, flashError] = useTimedFlag(2500);
  const [ratings, setRatings] = useState<Record<string, number>>({});

  useEffect(() => {
    api.ratings().then(setRatings).catch(() => {});
  }, []);

  // resetKey=needIdx → list flashes back to loading on tab switch, then fills.
  // Без внутреннего catch → []: отказ рисовал «Пока пусто» человеку со списком. Сбой ≠ пусто.
  const practicesFetcher = useCallback(
    () => api.getPractices(NEED_IDS[needIdx]),
    [needIdx],
  );
  const { data: practices, reload: reloadPractices, setData: setPractices, failed: practicesFailed } =
    useAsyncData<UserPractice[] | null>(practicesFetcher, null, needIdx);

  async function handleAdd() {
    const text = input.trim();
    if (!text || saving) return;
    setSaving(true);
    try {
      await api.addPractice(NEED_IDS[needIdx], text);
      setInput('');
      flashAdded();
      reloadPractices();
    } catch {
      flashError();
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(id: number) {
    setPractices(prev => prev?.filter(x => x.id !== id) ?? null);
    // Оптимистичное удаление: сбой возвращает список с сервера (иначе
    // практика «исчезала», оставаясь в БД, и воскресала при следующем заходе).
    api.deletePractice(id).catch(() => {
      flashError();
      reloadPractices();
    });
  }

  // Удаление двумя тапами (как в мини-аппе): первый — «Точно удалить?», второй стирает.
  const { tap: tapDelete, isPending: deletePending } = useConfirmTap<number>(handleDelete);

  const needId = NEED_IDS[needIdx];
  const todayScore = ratings[needId];
  const isLow = todayScore !== undefined && todayScore <= 4;
  const isMid = todayScore !== undefined && todayScore > 4 && todayScore <= 7;

  return (
    <div data-testid="practices-screen" className="u-sheet">
      <div className="sk-page sk-page--wide">
        <div className="ds-head-row sk-head">
          <div>
            <div className="ds-eyebrow">Пять потребностей</div>
            <h1 className="ds-h2 sk-title">Что меня<br /><em className="sk-it">питает</em></h1>
            <div className="ds-sub sk-lead sk-intro">
              {buildPracticesIntro(tr)}
              {onOpenTracker &&<> Что-то просело? <span {...pressable(onOpenTracker)} className="ds-link ds-link--inline">{tr('Открой трекер →', 'Откройте трекер →')}</span></>}
            </div>
          </div>
          <div className="sk-head-actions">
            {errorToast && <span className="sk-error">Ошибка сохранения</span>}
            {addedToast && <span className="sk-ok">Добавлено</span>}
            <button onClick={goBack} className="ds-btn ds-btn--secondary">Закрыть</button>
          </div>
        </div>

        <div className="ds-seg ds-seg--scroll">
          {NEED_IDS.map((id, i) => {
            const score = ratings[id];
            return (
              <button
                key={id}
                className={'ds-seg-btn' + (i === needIdx ? ' is-active' : '')}
                onClick={() => { setNeedIdx(i); setInput(''); }}
              >
                {NEED_NAMES[id]}
                {score !== undefined && <span className="ds-count">{score}</span>}
              </button>
            );
          })}
        </div>

        {(isLow || isMid) && (
          <div className="sk-hint tone-tint" style={hueStyle(NEED_HUE[needId as NeedId])}>
            {isLow
              ? <>Сегодня <b>{NEED_NAMES[needId]}</b> на {todayScore}/10 – хороший момент чтобы что-то сделать для этой потребности.</>
              : <>Сегодня {NEED_NAMES[needId]} – {todayScore}/10. Есть куда расти.</>}
          </div>
        )}

        <section className="sk-group">
          <div className="ds-head-row">
            <h3 className="ds-h3">{NEED_DATA[needId]?.name ?? NEED_NAMES[needId]}</h3>
            {practices && <span className="ds-sub">{practices.length} {pluralRu(practices.length, 'действие', 'действия', 'действий')}</span>}
          </div>
          {practicesFailed ? (
            <div role="alert" className="sk-error">
              {tr('Не удалось загрузить список. Проверь соединение и обнови страницу', 'Не удалось загрузить список. Проверьте соединение и обновите страницу')}
            </div>
          ) : !practices ? (
            <Loader minHeight="20vh" />
          ) : practices.length === 0 ? (
            <PaperEmpty>{tr('Пока пусто — добавь первое действие ниже.', 'Пока пусто — добавьте первое действие ниже.')}</PaperEmpty>
          ) : (
            <div className="sk-list">
              {practices.map(p => (
                <div key={p.id} className="ds-card ds-card--row sk-practice">
                  <div className="sk-practice-text">{p.text}</div>
                  <button onClick={() => tapDelete(p.id as number)} className="ds-link ds-link--danger">{deletePending(p.id as number) ? 'Точно удалить?' : 'удалить'}</button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="sk-group">
          <div className="ds-label">Новое действие</div>
          <div className="ds-sub">
            Небольшое конкретное действие – например «позвонить другу» или «прогулка 20 минут»
          </div>
          <div className="sk-add">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
              placeholder="Добавить действие..."
              maxLength={PRACTICE_TEXT_MAX}
              className="ds-input"
            />
            <button
              onClick={handleAdd}
              disabled={!input.trim() || saving}
              className="ds-btn"
            >
              {saving ? '...' : '+ Добавить'}
            </button>
          </div>
          {/* правило №7: свободный текст обязан проходить кризисную детекцию,
              до сохранения/шифрования — см. LetterEx/GratitudeEntrySheet */}
          {detectCrisisAny(input) && <CrisisCard surface="practice" />}
        </section>
      </div>
    </div>
  );
}
