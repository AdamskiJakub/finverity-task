import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProgramService } from '../program/program.service';
import { CreateReservationDto, Currency } from '../common/dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ReservationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly programService: ProgramService,
  ) {}

  async findByProgram(programId: string) {
    return this.prisma.reservation.findMany({
      where: { programId, status: 'ACTIVE' },
      orderBy: { id: 'asc' },
    });
  }

  async create(programId: string, dto: CreateReservationDto) {
    // Ensure program exists before starting transaction
    await this.programService.getProgramOrThrow(programId);

    return this.prisma.$transaction(async (tx) => {
      // Pessimistic lock: SELECT ... FOR UPDATE on the program row
      const [program] = await tx.$queryRaw<
        Array<{
          id: string;
          totalLimit: number;
          reservedAmount: number;
          version: number;
          currency: string;
        }>
      >(
        Prisma.sql`SELECT id, "totalLimit", "reservedAmount", version, currency FROM "Program" WHERE id = ${programId} FOR UPDATE`,
      );

      if (!program) {
        throw new NotFoundException(`Program ${programId} not found`);
      }

      // Check if invoice already has an ACTIVE reservation in this program
      // RELEASED reservations can be re-reserved (idempotency only for active ones)
      const existingReservation = await tx.reservation.findFirst({
        where: {
          programId,
          invoiceId: dto.invoiceId,
          status: 'ACTIVE',
        },
      });

      if (existingReservation) {
        throw new ConflictException(
          `Invoice ${dto.invoiceId} already has an active reservation in program ${programId}`,
        );
      }

      // Currency validation: invoice currency must match program currency
      if (dto.currency !== program.currency) {
        throw new BadRequestException(
          `Currency mismatch: program ${programId} is denominated in ${program.currency}, ` +
            `but reservation is in ${dto.currency}. Cross-currency reservations require an FX engine.`,
        );
      }

      // Check capacity
      const availableAmount = program.totalLimit - program.reservedAmount;
      if (availableAmount < dto.amount) {
        throw new BadRequestException(
          `Insufficient capacity: available ${availableAmount}, requested ${dto.amount}`,
        );
      }

      // Create reservation and update program atomically
      const reservation = await tx.reservation.create({
        data: {
          programId,
          invoiceId: dto.invoiceId,
          amount: dto.amount,
          currency: dto.currency as any,
          status: 'ACTIVE',
        },
      });

      await tx.program.update({
        where: { id: programId },
        data: {
          reservedAmount: { increment: dto.amount },
        },
      });

      return {
        reservationId: reservation.id,
        status: 'ACTIVE',
      };
    });
  }

  async release(programId: string, reservationId: string) {
    // Ensure program exists before starting transaction
    await this.programService.getProgramOrThrow(programId);

    return this.prisma.$transaction(async (tx) => {
      // Pessimistic lock on the program
      const [program] = await tx.$queryRaw<
        Array<{
          id: string;
        }>
      >(
        Prisma.sql`SELECT id FROM "Program" WHERE id = ${programId} FOR UPDATE`,
      );

      if (!program) {
        throw new NotFoundException(`Program ${programId} not found`);
      }

      // Find the reservation
      const reservation = await tx.reservation.findUnique({
        where: { id: reservationId },
      });

      if (!reservation) {
        throw new NotFoundException(`Reservation ${reservationId} not found`);
      }

      if (reservation.status !== 'ACTIVE') {
        throw new BadRequestException(
          `Reservation ${reservationId} is already ${reservation.status}`,
        );
      }

      if (reservation.programId !== programId) {
        throw new BadRequestException(
          `Reservation ${reservationId} does not belong to program ${programId}`,
        );
      }

      // Release: update status and decrement reserved amount
      await tx.reservation.update({
        where: { id: reservationId },
        data: {
          status: 'RELEASED',
          releasedAt: new Date(),
        },
      });

      await tx.program.update({
        where: { id: programId },
        data: {
          reservedAmount: { decrement: reservation.amount },
        },
      });

      return {
        status: 'RELEASED',
        releasedAmount: reservation.amount,
      };
    });
  }
}
