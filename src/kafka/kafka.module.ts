import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ReconciliationConsumer } from './reconciliation.consumer';
import { ProgramModule } from '../program/program.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'KAFKA_SERVICE',
        transport: Transport.KAFKA,
        options: {
          client: {
            brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
          },
          consumer: {
            groupId: 'capacity-service-consumer',
          },
        },
      },
    ]),
    ProgramModule,
    PrismaModule,
  ],
  providers: [ReconciliationConsumer],
})
export class KafkaModule {}
