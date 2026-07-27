import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface ReconciliationEvent {
  type: 'PROGRAM_RECONCILIATION';
  programId: string;
  currency: string;
  totalLimit: number;
  reservedAmount: number;
  version: number;
  timestamp: string;
}

@Injectable()
export class ReconciliationConsumer {
  private readonly logger = new Logger(ReconciliationConsumer.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Process a reconciliation event from Kafka.
   *
   * Idempotency: if incoming version <= current version, the event is ignored.
   * This handles at-least-once delivery semantics and out-of-order messages.
   */
  async processEvent(event: ReconciliationEvent) {
    this.logger.log(
      `Processing reconciliation event for program ${event.programId}, version ${event.version}`,
    );

    // Use a transaction to ensure atomicity of version check + update
    await this.prisma.$transaction(async (tx) => {
      // Get current program (if exists)
      const program = await tx.program.findUnique({
        where: { id: event.programId },
      });

      // Version check: ignore if incoming version <= current version
      if (program && event.version <= program.version) {
        this.logger.log(
          `Ignoring stale reconciliation for program ${event.programId}: ` +
            `incoming version ${event.version} <= current version ${program.version}`,
        );
        return;
      }

      // Save reconciliation snapshot
      await tx.reconciliationSnapshot.create({
        data: {
          programId: event.programId,
          totalLimit: event.totalLimit,
          reservedAmount: event.reservedAmount,
          currency: event.currency as any,
          version: event.version,
          timestamp: new Date(event.timestamp),
        },
      });

      // Upsert program with new state
      await tx.program.upsert({
        where: { id: event.programId },
        create: {
          id: event.programId,
          name: `Program ${event.programId}`,
          currency: event.currency as any,
          totalLimit: event.totalLimit,
          reservedAmount: event.reservedAmount,
          version: event.version,
        },
        update: {
          totalLimit: event.totalLimit,
          reservedAmount: event.reservedAmount,
          currency: event.currency as any,
          version: event.version,
        },
      });

      this.logger.log(
        `Reconciliation applied for program ${event.programId}, version ${event.version}`,
      );
    });
  }
}
