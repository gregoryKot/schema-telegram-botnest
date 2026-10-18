// Лист «Мой портрет»: пять потребностей с объяснениями, «Мои схемы» и «Мои
// режимы» с частотой за неделю и статусом карточки. Строка открывает экран
// паттерна — тот же PatternSheet и тот же слой, что в разделе «Паттерны»
// (usePatternLayer: частоты и статусы считаются там, второго счёта нет).
// Слой читает дневники только когда лист открыт.
import { SsSheet, SsHead } from '../../components/schemaSheets/SsSheet';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { useTr } from '../../utils/addressForm';
import { api } from '../../api';
import { usePatternLayer } from '../schemas/usePatternLayer';
import { portraitTexts } from '../../../../shared/src/portrait/portraitTexts';
import { PROFILE_PATTERN_OPEN_EVENT } from '../../../../shared/src/share/analytics';
import type { AboutMeState } from '../../../../shared/src/portrait/useAboutMe';
import type { MyCardsKind } from '../../../../shared/src/pattern/useMyCards';
import { PortraitNeedRows } from './PortraitNeedRows';
import { PortraitPatternRows } from './PortraitPatternRows';

interface Props {
  aboutMe: AboutMeState;
  onClose: () => void;
}

export function PortraitSheet({ aboutMe, onClose }: Props) {
  const tr = useTr();
  const goBack = useHistorySheet(onClose);
  const pat = usePatternLayer();
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

  return (
    <>
      <SsSheet onBack={goBack} narrow>
        <SsHead title={txt.title} lede={txt.hint} />
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
