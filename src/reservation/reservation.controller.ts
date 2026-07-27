import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiOkResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReservationService } from './reservation.service';
import {
  CreateReservationDto,
  CreateReservationResponseDto,
  ReleaseReservationDto,
  ReleaseReservationResponseDto,
} from '../common/dto';

@ApiTags('Reservations')
@ApiBearerAuth('JWT')
@Controller('programs')
@UseGuards(JwtAuthGuard)
export class ReservationController {
  constructor(private readonly reservationService: ReservationService) {}

  @Get(':id/reservations')
  @ApiOperation({ summary: 'List active reservations for a program' })
  @ApiParam({ name: 'id', description: 'Program ID', example: 'prog_001' })
  @ApiOkResponse({ description: 'Array of active reservations' })
  async listReservations(@Param('id') programId: string) {
    return this.reservationService.findByProgram(programId);
  }

  @Post(':id/reservations')
  @ApiOperation({ summary: 'Reserve capacity for an invoice' })
  @ApiParam({ name: 'id', description: 'Program ID', example: 'prog_001' })
  @ApiBody({ type: CreateReservationDto })
  @ApiOkResponse({ type: CreateReservationResponseDto })
  async createReservation(
    @Param('id') programId: string,
    @Body() dto: CreateReservationDto,
  ) {
    return this.reservationService.create(programId, dto);
  }

  @Post(':id/releases')
  @ApiOperation({ summary: 'Release a reservation and free capacity' })
  @ApiParam({ name: 'id', description: 'Program ID', example: 'prog_001' })
  @ApiBody({ type: ReleaseReservationDto })
  @ApiOkResponse({ type: ReleaseReservationResponseDto })
  async releaseReservation(
    @Param('id') programId: string,
    @Body() dto: ReleaseReservationDto,
  ) {
    return this.reservationService.release(programId, dto.reservationId);
  }
}
