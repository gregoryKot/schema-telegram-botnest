import { describe, expect, it } from 'vitest';
import { DOMAIN_HUE, MODE_GROUP_HUE, NEED_HUE } from '../../../theme/entityHue';
import { nodeHue, paperEdge, paperFill, shapePaint } from './diagramPaper';
import type { DiagramNode } from './diagramTypes';

const node = (patch: Partial<DiagramNode>): DiagramNode => ({
  id: 'n',
  kind: 'mode',
  shape: 'rounded',
  section: 'modes',
  x: 0,
  y: 0,
  w: 10,
  h: 10,
  label: '',
  color: '',
  ...patch,
});

describe('nodeHue', () => {
  it('режим — оттенок его группы', () => {
    expect(nodeHue(node({ modeId: 'vulnerable_child' }))).toBe(
      MODE_GROUP_HUE.child,
    );
    expect(nodeHue(node({ modeId: 'healthy_adult' }))).toBe(
      MODE_GROUP_HUE.healthy,
    );
  });

  it('схема и овал её опыта — оттенок домена', () => {
    const hue = DOMAIN_HUE.rejection;
    expect(nodeHue(node({ kind: 'schema', schemaId: 'abandonment' }))).toBe(
      hue,
    );
    expect(nodeHue(node({ kind: 'origin', schemaId: 'abandonment' }))).toBe(
      hue,
    );
  });

  it('потребность — свой оттенок', () => {
    expect(nodeHue(node({ kind: 'need', needId: 'play' }))).toBe(NEED_HUE.play);
  });

  it('заготовка и неизвестный id — без оттенка', () => {
    expect(nodeHue(node({ kind: 'placeholder' }))).toBeUndefined();
    expect(nodeHue(node({ modeId: 'custom:1' }))).toBeUndefined();
    expect(nodeHue(node({ kind: 'need', needId: 'nope' }))).toBeUndefined();
  });
});

describe('shapePaint', () => {
  it('с оттенком — бумага и контур того же оттенка, пустая фигура бледнее', () => {
    expect(shapePaint(28)).toEqual({
      fill: paperFill(28),
      stroke: paperEdge(28),
    });
    expect(shapePaint(28, true).stroke).toBe(paperEdge(28, true));
    expect(paperEdge(28, true)).not.toBe(paperEdge(28));
  });

  it('без оттенка — нейтральная бумага токенами', () => {
    expect(shapePaint(undefined).fill).toBe('var(--paper-sunk)');
  });
});
