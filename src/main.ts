import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Serve static files from public/ directory
  // In dev:  ../../public  (from dist/src/)
  // In prod: ../public    (from dist/src/)
  app.useStaticAssets(join(__dirname, '..', '..', 'public'), {
    index: 'index.html',
  });

  // Global validation pipe for DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger / OpenAPI documentation
  const config = new DocumentBuilder()
    .setTitle('Program Capacity & Invoice Reservation API')
    .setDescription(
      'Fintech service for managing financing program capacity and invoice reservations. ' +
        'Supports real-time capacity tracking with pessimistic locking, ' +
        'idempotent invoice reservations, and Kafka-based treasury reconciliation.',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'JWT',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // Kafka microservice for consuming reconciliation events
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
      },
      consumer: {
        groupId: 'capacity-service-consumer',
      },
      subscribe: {
        topics: ['program.reconciliation'],
        fromBeginning: true,
      } as any,
    },
  });

  await app.startAllMicroservices();
  await app.listen(process.env.PORT ?? 3000);

  console.log(
    `Capacity service is running on port ${process.env.PORT ?? 3000}`,
  );
  console.log('Kafka consumer listening for reconciliation events');
  console.log(
    `Swagger docs at http://localhost:${process.env.PORT ?? 3000}/api`,
  );
  console.log(`Demo UI at http://localhost:${process.env.PORT ?? 3000}`);
}
bootstrap();
