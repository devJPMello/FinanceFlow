import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173', credentials: true });
  app.setGlobalPrefix('api');
  const doc = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('FinanceFlow API').setVersion('0.1').addBearerAuth().build(),
  );
  SwaggerModule.setup('docs', app, doc);
  await app.listen(Number(process.env.PORT ?? 3000));
}
bootstrap();
