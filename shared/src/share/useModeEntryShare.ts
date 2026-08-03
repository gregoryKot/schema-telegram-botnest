// Состояние шита «поделиться записью режима» — общее для webapp/miniapp
// (правило №3). Ветвление (что доступно к шаре) и оба набора пропсов
// ShareCardSheet считает modeEntryShareOptions; хук добавляет только
// useState открытого варианта, по образцу shared/src/share/useShareCard.ts.
import { useState } from 'react';
import {
  modeEntryShareOptions,
  type ModeEntryFullSource,
} from './cards/modeEntryFullCard';
import type { ModeEntryMode } from './cards/modeEntryCard';

export type ModeEntryShareKind = 'short' | 'full' | null;

/** Стиль текстовой ссылки «Поделиться всей записью» — одинаков в обоих фронтах. */
export const modeEntryShareLinkStyle = {
  background: 'none',
  border: 'none',
  padding: 0,
  color: 'var(--text-sub)',
  fontSize: 12,
  fontWeight: 600,
  textDecoration: 'underline',
  cursor: 'pointer',
} as const;

export interface ModeEntryShareState {
  share: ModeEntryShareKind;
  setShare: (v: ModeEntryShareKind) => void;
  hasHealthy: boolean;
  hasFull: boolean;
  shortProps: ReturnType<typeof modeEntryShareOptions>['shortProps'];
  fullProps: ReturnType<typeof modeEntryShareOptions>['fullProps'];
}

export function useModeEntryShare(
  mode: ModeEntryMode | undefined,
  healthyResponse: string | null | undefined,
  entry: ModeEntryFullSource | undefined,
  link: string,
  dateLabel?: string,
): ModeEntryShareState {
  const [share, setShare] = useState<ModeEntryShareKind>(null);
  const { hasHealthy, hasFull, shortProps, fullProps } = modeEntryShareOptions(
    mode,
    healthyResponse,
    entry,
    link,
    dateLabel,
  );
  return { share, setShare, hasHealthy, hasFull, shortProps, fullProps };
}
