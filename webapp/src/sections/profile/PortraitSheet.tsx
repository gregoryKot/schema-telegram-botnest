// Лист «Мой портрет»: герой — лист шалфея (ENTITY_LOOK.portrait) со сценой ScenePortrait (пять
// полосок-потребностей, над каждой столько слоёв, сколько её схем — из данных), дата теста и дельта;
// ниже пять потребностей с объяснениями, «Мои схемы» и «Мои режимы» с частотой за неделю и
// статусом карточки. На ≥1024 — разворот: герой слева. Строка открывает экран паттерна — тот же
// PatternSheet и тот же слой, что в «Паттернах» (usePatternLayer: частоты и статусы считаются там).
// Дневники слой не читает: записи уже есть у useAboutMe профиля (один запрос).
import { SsSheet, SsHead } from '../../components/schemaSheets/SsSheet';
import { ScenePortrait } from '../../components/art/ScenePortrait';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { useDialogA11y } from '../../../../shared/src/utils/dialogA11y';
import { useTr } from '../../utils/addressForm';
import { api } from '../../api';
import { usePatternLayer } from '../schemas/usePatternLayer';
import { hasPortraitData } from '../../../../shared/src/portrait/portraitData';
import { portraitTexts } from '../../../../shared/src/portrait/portraitTexts';
import { PROFILE_PATTERN_OPEN_EVENT } from '../../../../shared/src/share/analytics';
import type { AboutMeState } from '../../../../shared/src/portrait/useAboutMe';
import type { MyCardsKind } from '../../../../shared/src/pattern/useMyCards';
import { PortraitNeedRows } from './PortraitNeedRows';
import { PortraitPatternRows } from './PortraitPatternRows';
import { PortraitTestLine } from './PortraitTestLine';

interface Props {
  aboutMe: AboutMeState;
  onClose: () => void;
}

export function PortraitSheet({ aboutMe, onClose }: Props) {
  const tr = useTr();
  const goBack = useHistorySheet(onClose);
  const dialogA11y = useDialogA11y(); // диктор узнаёт об открытом листе, фокус — внутрь
  const pat = usePatternLayer({ ...aboutMe, ready: aboutMe.diaries === 'ready' });
  const txt = portraitTexts(tr);
  const isEmpty = aboutMe.mySchemaIds.length === 0 && aboutMe.myModeIds.length === 0;
  const freq = pat.entriesReady ? { schema: pat.schemaFreq, mode: pat.modeFreq } : undefined;

  const rows = (kind: MyCardsKind, ids: string[]) => {
    const st = pat.statusOf(kind);
    return (
      <PortraitPatternRows kind={kind} ids={ids} freq={freq?.[kind]} filled={st.filled} statusFor={st.statusFor}
        onOpen={(id) => { void api.trackEvent(PROFILE_PATTERN_OPEN_EVENT, { kind }); pat.openPattern(kind, id); }} />
    );
  };
  const tested = !!aboutMe.ysqCompletedAt && hasPortraitData(aboutMe.portrait);
  const hero = (
    <SsHead look="portrait" title={txt.title} lede={txt.hint} heroArt={<ScenePortrait needs={aboutMe.portrait.needs} />}
      meta={tested ? <PortraitTestLine portrait={aboutMe.portrait} ysqCompletedAt={aboutMe.ysqCompletedAt} /> : undefined} />
  );

  return (
    <>
      <SsSheet onBack={goBack} hero={hero} spread dialog={{ ...dialogA11y, 'aria-label': txt.title }}>
        {isEmpty && <p className="ds-sub cpf-sheet-empty">{txt.emptySheet}</p>}
        <PortraitNeedRows needs={aboutMe.portrait.needs} />
        <div className="cpf-sheet-lists">
          {rows('schema', aboutMe.mySchemaIds)}
          {rows('mode', aboutMe.myModeIds)}
        </div>
      </SsSheet>
      {pat.layer}
    </>
  );
}
