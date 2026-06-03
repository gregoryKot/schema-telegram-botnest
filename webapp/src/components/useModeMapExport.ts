import { useCallback, useState } from 'react';
import { getNodesBounds, getViewportForBounds } from '@xyflow/react';
import { toPng } from 'html-to-image';
import type { FlowNode } from './modeMapFlow';

const FILTER_CLASSES = ['react-flow__minimap', 'react-flow__controls', 'react-flow__panel'];

export function useModeMapExport(nodes: FlowNode[]) {
  const [exporting, setExporting] = useState(false);

  const renderPng = useCallback(async (): Promise<{ url: string; w: number; h: number } | null> => {
    if (nodes.length === 0) return null;
    const W = 1600, H = 1100;
    const bounds = getNodesBounds(nodes);
    const vp = getViewportForBounds(bounds, W, H, 0.4, 2.5, 0.12);
    const viewportEl = document.querySelector('.react-flow__viewport') as HTMLElement | null;
    if (!viewportEl) return null;
    const bg = getComputedStyle(document.body).getPropertyValue('--bg').trim() || '#f5f2eb';
    const url = await toPng(viewportEl, {
      backgroundColor: bg, width: W, height: H, pixelRatio: 2,
      style: { width: `${W}px`, height: `${H}px`, transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})` },
      filter: (n) => !FILTER_CLASSES.some(c => n?.classList?.contains(c)),
    });
    return { url, w: W, h: H };
  }, [nodes]);

  const onExportPng = useCallback(async () => {
    setExporting(true);
    try {
      const png = await renderPng();
      if (!png) return;
      const a = document.createElement('a');
      a.download = `karta-rezhimov-${new Date().toISOString().slice(0, 10)}.png`;
      a.href = png.url; a.click();
    } catch { /* ignore */ } finally { setExporting(false); }
  }, [renderPng]);

  const onExportPdf = useCallback(async () => {
    setExporting(true);
    try {
      const png = await renderPng();
      if (!png) return;
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [png.w, png.h] });
      pdf.addImage(png.url, 'PNG', 0, 0, png.w, png.h);
      pdf.save(`karta-rezhimov-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch { /* ignore */ } finally { setExporting(false); }
  }, [renderPng]);

  return { exporting, onExportPng, onExportPdf };
}
