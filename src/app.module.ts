import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ProgramModule } from './program/program.module';
import { ReservationModule } from './reservation/reservation.module';
import { CapacityModule } from './capacity/capacity.module';
import { KafkaModule } from './kafka/kafka.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ProgramModule,
    ReservationModule,
    CapacityModule,
    KafkaModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
