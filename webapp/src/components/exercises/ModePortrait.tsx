// Портрет режима перед вопросами карточки (правило онбординга CLAUDE.md — сначала «откуда это и
// зачем», потом действие). Состав блоков общий с мини-аппом (modePortraitSections.ts, правило №3).
// Самое живое — «Что говорит» и «Что отвечает Здоровый Взрослый» — диалогом двух голосов (CardDialogue),
// остальные шесть — тихим списком, на широкой колонке в две колонки. card резолвит родитель.
import { buildModePortraitSections } from '../../../../shared/src/mode/modePortraitSections';
import type { ModeCard } from '../../../../shared/src/mode/modeCards';
import type { SignKey } from '../../../../shared/src/theme/entityLook';
import { glue } from '../../../../shared/src/utils/typo';
import { splitDialogue } from './cardFlow/cardEntities';
import { CardDialogue } from './cardFlow/CardDialogue';

interface Props {
  card: ModeCard;
  /** Бумага группы режима (MODE_GROUP_HUE) и её знак — у реплики «Что говорит». */
  hue: number;
  sign?: SignKey;
  onStart: () => void;
  /** Текст кнопки — иначе «Заполнить свою карточку →»; при возврате с вопросов — честная подпись про возврат. */
  ctaLabel?: string;
}

export function ModePortrait({ card, hue, sign, onStart, ctaLabel }: Props) {
  const { voice, healthy, rest } = splitDialogue(buildModePortraitSections(card));
  const line = (s?: { label: string; text: string }) => s && { label: s.label, text: glue(s.text) };
  return (
    <div className="ex2-portrait">
      <CardDialogue look={{ hue, sign }} voice={line(voice)} healthy={line(healthy)} />
      <dl className="ex2-portrait-facts">
        {rest.map((s) => (
          <div key={s.key} className="ex2-portrait-fact"><dt className="ds-label">{s.label}</dt><dd>{glue(s.text)}</dd></div>
        ))}
      </dl>
      <button className="ds-btn ex2-portrait-cta" onClick={onStart}>{ctaLabel ?? 'Заполнить свою карточку →'}</button>
    </div>
  );
}
