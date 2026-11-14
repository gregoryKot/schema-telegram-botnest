// Шит шаринга карточки: превью + «Поделиться» + «Скопировать текст»; логика — shared/useShareCard (№3).
// Превью — лист бумаги без рамки, по высоте вписан под обе кнопки (share-sheet.css).
import { useRef } from 'react';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { TherapyNote } from '../components/TherapyNote';
import { BottomSheetShell } from '../components/BottomSheetShell';
import { CheckIcon, ShareIcon } from '../../../shared/src/share/ShareIcon';
import { useShareCard } from '../../../shared/src/share/useShareCard';
import type { ShareCardKind } from '../../../shared/src/share/analytics';
import { api } from '../api';
import '../styles/sheet-diary.css';

interface Props {
  title: string;
  draw: (canvas: HTMLCanvasElement) => void;
  shareText: string;
  fallbackText?: string;
  filename: string;
  /** Тип карточки для аналитики share_card (правило №8) */
  eventKind: ShareCardKind;
  onClose: () => void;
  zIndex?: number;
  /** Заход на терапию после «Поделиться» (В10 аудита 2026-08) */
  therapyNote?: boolean;
}

export function ShareCardSheet({
  title,
  draw,
  shareText,
  fallbackText,
  filename,
  eventKind,
  onClose,
  zIndex = 300,
  therapyNote,
}: Props) {
  const goBack = useHistorySheet(onClose);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const s = useShareCard(canvasRef, {
    draw,
    shareText,
    fallbackText,
    filename,
    eventKind,
    track: api.trackEvent,
  });

  return (
    <BottomSheetShell goBack={goBack} zIndex={zIndex}>
        <h2 className="ds-h3 sd-share-title">{title}</h2>
        <div className="ds-sub sd-share-sub">Картинка уйдёт вместе со ссылкой</div>

        <div className="sd-canvas">
          <canvas ref={canvasRef} className="sd-canvas-el" />
        </div>

        {s.showText && <pre className="sd-pre">{s.text}</pre>}

        <button
          onClick={() => void s.share()}
          disabled={s.sharing}
          className="ds-btn sd-wide"
        >
          {s.saved ? <CheckIcon size={17} /> : <ShareIcon size={17} />}
          {s.shareLabel}
        </button>
        <button
          onClick={() => void s.copy()}
          className={'ds-btn ds-btn--secondary sd-wide sd-wide-gap' + (s.copied ? ' is-ok' : s.failed ? ' is-err' : '')}
        >
          {s.copied && <CheckIcon size={17} />}
          {s.copied ? 'Текст скопирован' : s.failed ? 'Не получилось' : 'Скопировать текст'}
        </button>
        {therapyNote && (
          <div className="u-mt12">
            <TherapyNote compact />
          </div>
        )}
    </BottomSheetShell>
  );
}
