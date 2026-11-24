// Режим или схема → статьи запросов, где они названы; id — из kb/concernLinks.ts, здесь только названия.
import { concernsOfMode, concernsOfSchema } from '../kb/concernLinks';
import type { GuideBacklink } from './backlinks';
import { buildConcernGuides } from './index';
import type { Tr } from './types';

function concernLinks(tr: Tr, ids: string[]): GuideBacklink[] {
  const names = new Map(buildConcernGuides(tr).map((c) => [c.id, c.name]));
  return [...new Set(ids)].flatMap((id) => {
    const name = names.get(id);
    return name ? [{ id, name }] : [];
  });
}

export const modeConcernLinks = (tr: Tr, modeId: string): GuideBacklink[] =>
  concernLinks(tr, concernsOfMode(modeId));

export const schemaConcernLinks = (tr: Tr, schemaId: string): GuideBacklink[] =>
  concernLinks(tr, concernsOfSchema(schemaId));
