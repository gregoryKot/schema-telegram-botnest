import { describe, it, expect } from 'vitest';
import { SCHEMA_DOMAINS } from '../../schemaTherapyData';
import { schemaDraft, schemaNode } from './schemaDraft';
import { canvasConcept } from './conceptSync';

describe('schemaDraft', () => {
  it('формат узла: schema + schemaId + название + цвет домена', () => {
    const d = schemaDraft('abandonment')!;
    expect(d.type).toBe('schema');
    expect(d.data).toMatchObject({ schemaId: 'abandonment', label: 'Покинутость / Нестабильность', customColor: SCHEMA_DOMAINS[0].color });
  });

  it('неизвестная схема — null', () => {
    expect(schemaDraft('nope')).toBeNull();
  });

  it('id узлов уникальны', () => {
    expect(schemaNode('a', 'A', '#000').id).not.toBe(schemaNode('a', 'A', '#000').id);
  });

  // Шов палитры и синхронизации холста с концептуализацией (#963): заготовка из
  // каталога схем обязана распознаваться как схема, иначе формат узла и
  // canvasConcept разъедутся молча.
  it('заготовка из каталога схем распознаётся canvasConcept как схема', () => {
    const all = SCHEMA_DOMAINS.flatMap(d => d.schemas.map(s => schemaNode(s.id, s.name, d.color)));
    const c = canvasConcept(all, []);
    expect([...c.schemas].sort()).toEqual(SCHEMA_DOMAINS.flatMap(d => d.schemas.map(s => s.id)).sort());
  });
});
