import { Controller, Get, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const INDEX_PATH = join(__dirname, '..', 'webapp', 'dist', 'index.html');

@Controller()
export class MetaController {
  private readonly html = existsSync(INDEX_PATH)
    ? readFileSync(INDEX_PATH, 'utf8')
    : null;

  @Get('/')
  serve(@Req() req: Request, @Res() res: Response) {
    if (!this.html) return res.status(404).send('Not found');

    const domain = req.hostname;
    const isAlias = domain === 'kotlarewski.ru' || domain === 'kotlarewski.gr';

    const html = isAlias
      ? this.html
          // og:url and canonical point to canonical schemalab.ru by default;
          // swap them to the actual domain so Telegram shows a preview card
          .replace('href="https://schemalab.ru/"', `href="https://${domain}/"`)
          .replace('content="https://schemalab.ru/"', `content="https://${domain}/"`)
      : this.html;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  }
}
