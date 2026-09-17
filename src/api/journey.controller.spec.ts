// «Мой путь» — только чтение, тело запроса отсутствует. Единственный класс
// бага здесь: userId для журнала обязан браться из авторизованного req,
// а не быть перепутан/захардкожен — иначе юзер А увидит архив юзера Б.
import { JourneyController } from './journey.controller';
import type { JourneyService } from '../bot/journey.service';

function makeReq(userId = 1n) {
  return { webUser: { userId } } as any;
}

describe('JourneyController.getJourney', () => {
  it('запрашивает журнал именно того userId, что в req.webUser (не константа)', async () => {
    const getJourney = jest.fn().mockResolvedValue({ counters: {}, feed: [] });
    const controller = new JourneyController({
      getJourney,
    } as unknown as JourneyService);

    await controller.getJourney(makeReq(777n));

    expect(getJourney).toHaveBeenCalledWith(777n);
  });

  it('возвращает результат сервиса как есть (без искажений на пути наружу)', async () => {
    const journey = {
      counters: { schemaDiary: 3, modeDiary: 0 },
      feed: [{ type: 'schema', id: 1 }],
    };
    const getJourney = jest.fn().mockResolvedValue(journey);
    const controller = new JourneyController({
      getJourney,
    } as unknown as JourneyService);

    await expect(controller.getJourney(makeReq(1n))).resolves.toEqual(journey);
  });
});
