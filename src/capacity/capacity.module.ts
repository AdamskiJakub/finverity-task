import { Module } from '@nestjs/common';
import { CapacityController } from './capacity.controller';
import { ProgramModule } from '../program/program.module';

@Module({
  imports: [ProgramModule],
  controllers: [CapacityController],
})
export class CapacityModule {}
