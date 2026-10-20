// Каркас листа «Настроить экран»: оболочка (лист снизу на телефоне, окно по
// центру на десктопе), заголовок, подзаголовок и кнопка «Готово». Один на все
// экраны (правило «одна механика — один компонент»): «Сегодня» кладёт внутрь
// свои группы, «Профиль»/«Паттерны» — ScreenCustomizeSheet.
import type { ReactNode } from 'react';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { BottomSheetShell } from '../BottomSheetShell';
import '../../styles/customize.css';

interface Props {
  title: string;
  subtitle: string;
  onClose: () => void;
  /** Группы листа; goBack — закрыть лист через историю (кнопки внутри). */
  children: (goBack: () => void) => ReactNode;
}

export function CustomizeSheetFrame({ title, subtitle, onClose, children }: Props) {
  const goBack = useHistorySheet(onClose);
  return (
    <BottomSheetShell goBack={goBack} zIndex={260} label={title}>
      <h2 className="ds-h3">{title}</h2>
      <div className="ds-sub cz-lead">{subtitle}</div>
      {children(goBack)}
      <button type="button" className="ds-btn cz-done" onClick={goBack}>Готово</button>
    </BottomSheetShell>
  );
}
