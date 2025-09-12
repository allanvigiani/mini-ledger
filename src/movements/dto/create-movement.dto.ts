import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsEnum,
  IsOptional,
  Min,
} from 'class-validator';
import { MovementType } from '@prisma/client';

export class CreateMovementDto {
  @IsString()
  @IsNotEmpty()
  account_id: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsEnum(MovementType)
  @IsNotEmpty()
  type: MovementType;

  @IsString()
  @IsOptional()
  description?: string;
}
