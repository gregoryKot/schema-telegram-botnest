import { buildPracticesIntro } from '../../../shared/src/onboarding/onboardingExplainers';
import { PRACTICE_TEXT_MAX } from '../../../shared/src/limits/textLimits';
import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import type { UserPractice } from '../api';
import { useAsyncData } from '../hooks/useAsyncData';
import { SkeletonList } from './Skeleton';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { useConfirmTap } from '../../../shared/src/hooks/useConfirmTap';
import { useTimedFlag } from '../../../shared/src/hooks/useTimedFlag';
import { useTr } from '../utils/addressForm';
import { useNeedData } from '../needData';
import { pressable } from '../utils/a11y';
import { detectCrisisAny } from '../utils/crisisMarkers';
import { CrisisCard } from './CrisisCard';
import { PaperEmpty } from './art/PaperEmpty';
import { NeedArt } from './art/NeedArt';
import { EntitySheet } from './paper/EntitySheet';
import { PaperAlert } from './paper/PaperAlert';
import { GlyphArrowLeft } from './exercises/ExScreen';
import { NeedTiles } from './plans/NeedTiles';
import { NourishRow, NeedScore } from './plans/NourishParts';
import type { ArtProps } from './art/paper';
import { pluralRu } from '../../../shared/src/utils/pluralRu';
import { NEED_ORDER } from '../../../shared/src/needs/types';
import '../styles/sheet-tasks.css';
const NEED_IDS: readonly string[] = NEED_ORDER;
const NEED_NAMES: Record<string, string> = {
  attachment: 'Привязанность', autonomy: 'Автономия',
  expression: 'Выражение чувств', play: 'Спонтанность', limits: 'Границы',
};
/** Пусто у потребности — её знак, а не чашка (PaperEmpty art): компонент на потребность создаётся один раз. */
const NEED_EMPTY_ART = Object.fromEntries(NEED_IDS.map(id => [id, function NeedEmptyArt({ size }: ArtProps) {
  return <NeedArt id={id} size={size} />;
}]));

interface Props {
  onClose: () => void;
  onOpenTracker?: () => void;
}

// «Что меня питает» (b20): шапка — лист «Что питает» (мох 145 + Leaf из ENTITY_LOOK) с объяснением «откуда и зачем»;
// выбор потребности — пять плиток бумаги NEED_HUE (NeedTiles, та же механика, что на пустых «Планах») с оценкой за
// сегодня полоской, а не цифрой без подписи; под ними — открытая потребность: знак, название, счётчик, подсказка
// по оценке строкой (была розовая плашка, похожая на ошибку), действия — строки с Leaf, «удалить» — тихой ссылкой.
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
      void reloadPractices(); // reload из useAsyncData не отклоняется: сбой ставит practicesFailed, экран говорит «не загрузилось»
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
      void reloadPractices(); // не отклоняется (см. выше)
    });
  }

  // Удаление двумя тапами (как в мини-аппе): первый — «Точно удалить?», второй стирает.
  const { tap: tapDelete, isPending: deletePending } = useConfirmTap<number>(handleDelete);

  const needId = NEED_IDS[needIdx];
  const todayScore = ratings[needId];
  const isLow = todayScore !== undefined && todayScore <= 4;
  const isMid = todayScore !== undefined && todayScore > 4 && todayScore <= 7;

  return (
    <div data-testid="practices-screen" className="u-sheet-grid sk-feeds">
      <div className="ds-sheet-head">
        <button type="button" className="ds-back" onClick={goBack}><GlyphArrowLeft /> Закрыть</button>
        {errorToast && <span className="sk-error">Ошибка сохранения</span>}
        {addedToast && <span className="sk-ok">Добавлено</span>}
      </div>
      <div className="sk-scroll">
        <div className="sk-page sk-page--wide">
          <EntitySheet look="nourish" label="Пять потребностей" title="Что меня питает" titleAs="h1" sub={<>
            {buildPracticesIntro(tr)}
            {onOpenTracker && <> Что-то просело? <span {...pressable(() => goBack(onOpenTracker))} className="ds-link ds-link--inline">{tr('Открой трекер →', 'Откройте трекер →')}</span></>}
          </>} />

          <NeedTiles label="Потребность" value={needId} onPick={id => { setNeedIdx(Math.max(0, NEED_IDS.indexOf(id))); setInput(''); }}
            meta={id => ratings[id] !== undefined && <NeedScore score={ratings[id]} />} />

          <section className="sk-group sk-feed-need">
            <div className="sk-feed-head">
              <span className="pp-row-art" aria-hidden="true"><NeedArt id={needId} size="row" /></span>
              <h2 className="sk-group-title">{NEED_DATA[needId]?.name ?? NEED_NAMES[needId]}</h2>
              {practices && <span className="ds-sub">{practices.length} {pluralRu(practices.length, 'действие', 'действия', 'действий')}</span>}
            </div>
            {(isLow || isMid) && (
              <p className="sk-feed-hint">
                {isLow
                  ? <>Сегодня <b>{NEED_NAMES[needId]}</b> на {todayScore}/10 – хороший момент чтобы что-то сделать для этой потребности.</>
                  : <>Сегодня {NEED_NAMES[needId]} – {todayScore}/10. Есть куда расти.</>}
              </p>
            )}
            {practicesFailed ? (
              <PaperAlert sign="leaf" onRetry={() => void reloadPractices()}
                title={tr('Не удалось загрузить список. Проверь соединение и обнови страницу', 'Не удалось загрузить список. Проверьте соединение и обновите страницу')} />
            ) : !practices ? (
              <div aria-hidden="true"><SkeletonList rows={3} height={56} /></div>
            ) : practices.length === 0 ? (
              <PaperEmpty art={NEED_EMPTY_ART[needId]}>{tr('Пока пусто — добавь первое действие ниже.', 'Пока пусто — добавьте первое действие ниже.')}</PaperEmpty>
            ) : (
              <div className="sk-list">
                {practices.map(p => (
                  <NourishRow key={p.id} text={p.text} pending={deletePending(p.id as number)} onDelete={() => tapDelete(p.id as number)} />
                ))}
              </div>
            )}
          </section>

          <section className="sk-group sk-feed-add">
            <div className="ds-label">Новое действие</div>
            <div className="ds-sub">
              Небольшое конкретное действие – например «позвонить другу» или «прогулка 20 минут»
            </div>
            <div className="sk-add">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void handleAdd(); /* сбой ловит сам: тост ошибки */ }}
                placeholder="Добавить действие..."
                maxLength={PRACTICE_TEXT_MAX}
                className="ds-input"
              />
              <button onClick={handleAdd} disabled={!input.trim() || saving} className="ds-btn">
                {saving ? '...' : '+ Добавить'}
              </button>
            </div>
            {/* правило №7: свободный текст обязан проходить кризисную детекцию,
                до сохранения/шифрования — см. LetterEx/GratitudeEntrySheet */}
            {detectCrisisAny(input) && <CrisisCard surface="practice" />}
          </section>
        </div>
      </div>
    </div>
  );
}
