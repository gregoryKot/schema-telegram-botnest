export type Tab = 'schemas' | 'modes' | 'needs';

export interface SchemasSectionProps {
  onOpenSchema: (opts?: {
    startTest?: boolean;
    tab?: 'needs' | 'schemas' | 'modes';
    highlight?: string;
  }) => void;
  childhoodRatings?: Record<string, number>;
  onOpenChildhoodWheel?: () => void;
  onOpenDiaries?: () => void;
  /** Открыть сразу на этой вкладке — переход с карточек «Мои схемы»/«Мои
   *  режимы» вкладки «Я» (по умолчанию 'schemas', как и раньше). */
  initialTab?: 'schemas' | 'modes';
}
