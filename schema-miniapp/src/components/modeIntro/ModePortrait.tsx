// Портрет режима: 8 содержательных блоков перед вопросами карточки (правило
// онбординга CLAUDE.md — сначала «откуда это и зачем», потом действие).
// Одна главная кнопка на экран. Состав блоков общий с вебаппом
// (shared/src/mode/modePortraitSections.ts, правило №3). Презентационный
// компонент — card резолвит родитель (ModeIntroSheet), чтобы не тянуть сюда
// реестр modeCards напрямую.
import type { ReactNode } from 'react';
import { BottomSheet } from '../BottomSheet';
import { TherapyNote } from '../TherapyNote';
import { buildModePortraitSections } from '../../../../shared/src/mode/modePortraitSections';
import type { ModeCard } from '../../../../shared/src/mode/modeCards';
import { cm } from '../../sections/schemas/utils';

interface Props {
  onClose: () => void;
  /** Цветной кружок режима (`<IdentityDot color={...} />`, волна 6) — заменил
   *  эмодзи, но проп сохранён под тем же именем, чтобы не плодить диффы. */
  emoji: ReactNode;
  name: string;
  groupName: string;
  accentColor: string;
  card: ModeCard;
  explainer: string;
  onStart: () => void;
  /** Текст главной кнопки — иначе первичное «Заполнить свою карточку →».
   *  При возврате к портрету с экрана вопросов (кнопка «Про режим»)
   *  передавай честную формулировку про возврат, а не про начало. */
  ctaLabel?: string;
}

export function ModePortrait({
  onClose,
  emoji,
  name,
  groupName,
  accentColor,
  card,
  explainer,
  onStart,
  ctaLabel,
}: Props) {
  const sections = buildModePortraitSections(card);
  return (
    <BottomSheet onClose={onClose}>
      <div style={{ paddingTop: 4 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              flexShrink: 0,
              background: cm(accentColor, 9),
              border: `1px solid ${cm(accentColor, 16)}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
            }}
          >
            {emoji}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--text)',
                letterSpacing: '-0.3px',
              }}
            >
              {name}
            </div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: accentColor,
                marginTop: 2,
              }}
            >
              {groupName}
            </div>
          </div>
        </div>

        <div
          style={{
            background: cm(accentColor, 5),
            border: `1px solid ${cm(accentColor, 13)}`,
            borderRadius: 16,
            padding: '12px 14px',
            marginBottom: 16,
            fontSize: 13,
            color: 'var(--text-sub)',
            lineHeight: 1.6,
          }}
        >
          {card.about}
        </div>

        <div
          style={{
            fontSize: 13,
            color: 'var(--text-faint)',
            lineHeight: 1.5,
            marginBottom: 16,
          }}
        >
          {explainer}
        </div>

        <div style={{ marginBottom: 20 }}>
          {sections.map((s, i) => (
            <div
              key={s.key}
              style={{
                padding: '14px 0',
                borderBottom:
                  i < sections.length - 1
                    ? '1px solid var(--border-color)'
                    : 'none',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: accentColor,
                  marginBottom: 6,
                }}
              >
                {s.label}
              </div>
              <div
                style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.55 }}
              >
                {s.text}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onStart}
          style={{
            width: '100%',
            minHeight: 48,
            borderRadius: 14,
            border: 'none',
            background: accentColor,
            color: '#fff',
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
            marginBottom: 16,
          }}
        >
          {ctaLabel ?? 'Заполнить свою карточку →'}
        </button>

        <TherapyNote compact />
      </div>
    </BottomSheet>
  );
}
