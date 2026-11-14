// Карта режимов глазами клиента (my-mode-maps/:mapId). Вместе с картой уходят
// оценки колеса потребностей — только оценки: заметки листа остаются у
// терапевта. Белый список, как в client-concept-view.ts: поле колеса, которого
// нет в сборщиках ниже, клиенту не уходит.
import type { ModeMap } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { decryptRecord, EncryptSchema } from '../utils/crypto';
import { clientSeesMap } from './client-map-authors';
import {
  ConceptNeedLink,
  NEED_PERIODS,
  NeedPeriod,
  readNeedLinks,
} from './concept-need-links';

/** Оценки одной потребности на карте клиента: без заметок листа. */
export interface ClientNeedRating {
  needId: string;
  ratings: Partial<Record<NeedPeriod, number>>;
}

// Собирается поле за полем: `notes` и любое новое поле ConceptNeedLink клиенту
// не уходит, пока его не добавят сюда осознанно.
export const clientNeedRatings = (
  links: ConceptNeedLink[],
): ClientNeedRating[] =>
  links
    .filter((l) => Object.keys(l.ratings).length > 0)
    .map((l) => ({ needId: l.needId, ratings: { ...l.ratings } }));

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null;

/** Узел-колесо: тот же признак, что на сайте (`!!data.wheel`). */
const isWheelNode = (node: unknown): node is Obj & { data: Obj } =>
  isObj(node) && isObj(node.data) && !!node.data.wheel;

// В узле клиенту нужен только вид колеса. У старых карт там же лежат оценки и
// заметки листа — их отбрасываем вместе с любым чужим ключом.
function wheelView(wheel: unknown): { period?: NeedPeriod; compare?: true } {
  const w = isObj(wheel) ? wheel : {};
  const period = NEED_PERIODS.find((p) => p === w.period);
  return {
    ...(period ? { period } : {}),
    ...(w.compare === true ? { compare: true as const } : {}),
  };
}

const clientNode = (node: unknown): unknown =>
  isWheelNode(node)
    ? { ...node, data: { ...node.data, wheel: wheelView(node.data.wheel) } }
    : node;

/** Поля ModeMap под encryptRecord — один список для кабинета и выгрузки. */
export const MODE_MAP_SCHEMA: EncryptSchema = {
  strings: ['title'],
  jsonArrays: ['nodes', 'edges'],
};

/** Карта клиента по id: узлы без заметок колеса + оценки колеса отдельным полем. */
export async function clientModeMap(
  prisma: PrismaService,
  clientId: bigint,
  mapId: number,
  schema: EncryptSchema,
) {
  const row = await prisma.modeMap.findUnique({ where: { id: mapId } });
  if (!row || !(await clientSeesMap(prisma, clientId, row)))
    throw new Error('Not found');
  return clientModeMapView(prisma, row, schema);
}

/** Вид клиента для строки, которую он видит (проверка — на вызывающем). */
export async function clientModeMapView(
  prisma: PrismaService,
  row: ModeMap,
  schema: EncryptSchema,
) {
  const map = decryptRecord(row, schema);
  const nodes: unknown = map.nodes;
  const hasWheel = Array.isArray(nodes) && nodes.some(isWheelNode);
  // Колесо — строго пары (автор карты, её клиент); без колеса на карте
  // концептуализацию не читаем.
  const concept = hasWheel
    ? await prisma.clientConceptualization.findUnique({
        where: {
          therapistId_clientId: {
            therapistId: row.therapistId,
            clientId: row.clientId,
          },
        },
        select: { needLinks: true },
      })
    : null;
  return {
    ...map,
    nodes: Array.isArray(nodes) ? nodes.map(clientNode) : nodes,
    needRatings: clientNeedRatings(readNeedLinks(concept?.needLinks)),
  };
}
