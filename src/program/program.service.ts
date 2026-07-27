import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Currency } from '../common/dto';

@Injectable()
export class ProgramService {
  constructor(private readonly prisma: PrismaService) {}

  async getProgramOrThrow(programId: string) {
    const program = await this.prisma.program.findUnique({
      where: { id: programId },
    });

    if (!program) {
      throw new NotFoundException(`Program ${programId} not found`);
    }

    return program;
  }

  async getCapacity(programId: string) {
    const program = await this.getProgramOrThrow(programId);

    return {
      programId: program.id,
      currency: program.currency as Currency,
      totalLimit: program.totalLimit,
      reservedAmount: program.reservedAmount,
      availableAmount: program.totalLimit - program.reservedAmount,
    };
  }
}
