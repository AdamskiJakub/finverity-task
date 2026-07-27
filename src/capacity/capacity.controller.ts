import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProgramService } from '../program/program.service';
import { CapacityResponseDto } from '../common/dto';

@ApiTags('Capacity')
@ApiBearerAuth('JWT')
@Controller('programs')
@UseGuards(JwtAuthGuard)
export class CapacityController {
  constructor(private readonly programService: ProgramService) {}

  @Get(':id/capacity')
  @ApiOperation({ summary: 'Get current capacity for a program' })
  @ApiParam({ name: 'id', description: 'Program ID', example: 'prog_001' })
  @ApiOkResponse({ type: CapacityResponseDto })
  async getCapacity(
    @Param('id') programId: string,
  ): Promise<CapacityResponseDto> {
    return this.programService.getCapacity(programId);
  }
}
