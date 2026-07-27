import { IsString, IsInt, IsEnum, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum Currency {
  USD = 'USD',
  EUR = 'EUR',
  GBP = 'GBP',
  PLN = 'PLN',
}

export class LoginDto {
  @ApiProperty({ example: 'admin', description: 'Username' })
  @IsString()
  username: string;

  @ApiProperty({ example: 'admin', description: 'Password' })
  @IsString()
  password: string;
}

export class LoginResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIs...' })
  accessToken: string;
}

export class CreateReservationDto {
  @ApiProperty({
    example: 'INV-001',
    description: 'External invoice identifier',
  })
  @IsString()
  invoiceId: string;

  @ApiProperty({
    example: 500000,
    description: 'Amount in minor units (cents)',
  })
  @IsInt()
  @Min(1)
  amount: number;

  @ApiProperty({
    enum: Currency,
    example: Currency.USD,
    description: 'Currency code',
  })
  @IsEnum(Currency)
  currency: Currency;
}

export class CreateReservationResponseDto {
  @ApiProperty({ example: 'cms3mo7h7000001ny8bi3nn0k' })
  reservationId: string;

  @ApiProperty({ enum: ['ACTIVE'], example: 'ACTIVE' })
  status: string;
}

export class ReleaseReservationDto {
  @ApiProperty({
    example: 'cms3mo7h7000001ny8bi3nn0k',
    description: 'Reservation ID to release',
  })
  @IsString()
  reservationId: string;
}

export class ReleaseReservationResponseDto {
  @ApiProperty({ example: 'RELEASED' })
  status: string;

  @ApiProperty({
    example: 500000,
    description: 'Amount released in minor units (cents)',
  })
  releasedAmount: number;
}

export class CapacityResponseDto {
  @ApiProperty({ example: 'prog_001' })
  programId: string;

  @ApiProperty({ enum: Currency, example: Currency.USD })
  currency: Currency;

  @ApiProperty({
    example: 1000000,
    description: 'Total program limit in minor units (cents)',
  })
  totalLimit: number;

  @ApiProperty({
    example: 500000,
    description: 'Currently reserved amount in minor units (cents)',
  })
  reservedAmount: number;

  @ApiProperty({
    example: 500000,
    description: 'Available capacity in minor units (cents)',
  })
  availableAmount: number;
}
