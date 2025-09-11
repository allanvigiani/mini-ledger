import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateAccountDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(11)
  document: string;

  @IsNumber()
  @IsOptional()
  credit_limit?: number;

  @IsNumber()
  @IsOptional()
  balance?: number;
}
