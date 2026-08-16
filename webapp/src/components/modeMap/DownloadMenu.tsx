import { useRef } from 'react';
import type { FlowNode } from '../modeMapFlow';
import { useModeMapExport } from '../useModeMapExport';
import { MMIcon } from '../modeMapIcons';
import { TbBtn, Dropdown } from './ToolbarControls';

const menuItemStyle: React.CSSProperties = {
  display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px',
  borderRadius: 5, fontSize: 12.5, cursor: 'pointer', background: 'none', border: 'none', color: 'var(--text)',
};

interface Props {
  nodes: FlowNode[];
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}

// Кнопка «Скачать карту» + меню PNG/PDF. Вынесено из ModeMapCanvas.tsx (правило
// №10 — холст уже на потолке 300 строк). Раньше сбой рендера/сборки файла
// (упавший toPng, недогрузившийся офлайн import('jspdf')) молчал: ни файла, ни
// объяснения — терапевт жал кнопку ещё раз и решал, что она сломана. Меню
// нарочно не закрывается по клику самим — иначе строка отказа гасится раньше,
// чем терапевт успевает её прочитать; закрывает переключатель или клик мимо.
export function DownloadMenu({ nodes, open, onToggle, onClose }: Props) {
  const { exporting, exportError, onExportPng, onExportPdf } = useModeMapExport(nodes);
  const wrapRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <TbBtn label="Скачать карту (PNG / PDF)" onClick={onToggle}
        active={open} caret disabled={nodes.length === 0}><MMIcon name="download" size={17} /></TbBtn>
      {open && (
        <Dropdown anchorRef={wrapRef} onClose={onClose}>
          <button disabled={exporting} onClick={() => onExportPng()} style={menuItemStyle}>Картинка PNG</button>
          <button disabled={exporting} onClick={() => onExportPdf()} style={menuItemStyle}>Документ PDF</button>
          {exportError && (
            <div style={{ padding: '6px 10px 2px', fontSize: 11, color: 'var(--accent-red)' }}>
              Не удалось подготовить файл. Стоит попробовать ещё раз
            </div>
          )}
        </Dropdown>
      )}
    </div>
  );
}
