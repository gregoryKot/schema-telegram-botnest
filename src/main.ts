import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  // Create a non-HTTP Nest application context for a bot-only app
  const app = await NestFactory.createApplicationContext(AppModule);
  // Keep process alive while bot runs; lifecycle hooks handle bot launch/stop
}

bootstrap();
