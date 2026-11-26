// modeMapRegistry.ts — реестр компонентов узла/ребра для @xyflow/react
// (NODE_TYPES/EDGE_TYPES передаются напрямую в <ReactFlow>). 0% покрытия.
// Реальный риск: рассинхрон между типами, известными modeMapData.ts, и тем,
// что реально зарегистрировано здесь — забытый тип рендерится дефолтным
// прямоугольником xyflow без стилей продукта, молча.
import { describe, it, expect } from 'vitest';
import { NODE_TYPES, EDGE_TYPES } from './modeMapRegistry';
import { TYPE_COLORS, type NodeType } from './modeMapData';

describe('NODE_TYPES', () => {
  it('регистрирует компонент для каждого типа узла из TYPE_COLORS — набор ключей идентичен', () => {
    expect(new Set(Object.keys(NODE_TYPES))).toEqual(new Set(Object.keys(TYPE_COLORS)));
  });

  it('каждый зарегистрированный тип — функция-компонент, а не undefined/объект', () => {
    (Object.keys(NODE_TYPES) as NodeType[]).forEach(type => {
      expect(typeof NODE_TYPES[type], type).toBe('function');
    });
  });

  it('все компоненты в реестре различны — ни один тип не задваивает чужой рендер', () => {
    const components = Object.values(NODE_TYPES);
    expect(new Set(components).size).toBe(components.length);
  });
});

describe('EDGE_TYPES', () => {
  it('регистрирует ровно тип floating (единственный кастомный тип ребра карты)', () => {
    expect(Object.keys(EDGE_TYPES)).toEqual(['floating']);
  });

  it('floating — функция-компонент', () => {
    expect(typeof EDGE_TYPES.floating).toBe('function');
  });
});
