// DTO-рефактор CRUD статей блога (аудит 2026-07, 2г / правило №6
// CLAUDE.md). Раньше ArticleDto импортировался как `type` — рантайм
// вообще не проверялся.
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ArticleDto, UpdateArticleDto } from './article.dto';

async function errorsFor(
  cls: new () => object,
  body: Record<string, unknown>,
): Promise<string[]> {
  const dto = plainToInstance(cls, body);
  const errs = await validate(dto, { whitelist: true });
  return errs.map((e) => e.property);
}

const VALID = {
  slug: 'schema-therapy-101',
  title: 'Что такое схема-терапия',
  description: 'Короткое описание',
  content: '# Заголовок\n\nТекст статьи',
  date: '2026-07-14',
  readMin: 5,
};

describe('ArticleDto', () => {
  it('валидная статья проходит', async () => {
    await expect(errorsFor(ArticleDto, VALID)).resolves.toEqual([]);
  });

  it('без обязательных полей — отказ', async () => {
    const errs = await errorsFor(ArticleDto, { slug: 'x' });
    expect(errs).toEqual(
      expect.arrayContaining(['title', 'description', 'content', 'date']),
    );
  });

  it('heroImage: null (сброс картинки) проходит', async () => {
    await expect(
      errorsFor(ArticleDto, { ...VALID, heroImage: null }),
    ).resolves.toEqual([]);
  });

  it('heroImage: число — отказ', async () => {
    await expect(
      errorsFor(ArticleDto, { ...VALID, heroImage: 42 }),
    ).resolves.toContain('heroImage');
  });
});

describe('UpdateArticleDto', () => {
  it('пустое тело проходит (частичное обновление)', async () => {
    await expect(errorsFor(UpdateArticleDto, {})).resolves.toEqual([]);
  });

  it('diagramKey: null проходит, readMin отрицательный — отказ', async () => {
    await expect(
      errorsFor(UpdateArticleDto, { diagramKey: null, readMin: -1 }),
    ).resolves.toContain('readMin');
  });
});
