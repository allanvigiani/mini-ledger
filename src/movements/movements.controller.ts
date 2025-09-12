import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ValidationPipe,
  UsePipes,
} from '@nestjs/common';
import { MovementsService } from './movements.service';
import { CreateMovementDto } from './dto/create-movement.dto';

@Controller('movements')
export class MovementsController {
  constructor(private readonly movementsService: MovementsService) {}

  @Post('/')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async create(@Body() createMovementDto: CreateMovementDto) {
    const movement = await this.movementsService.create(createMovementDto);
    return {
      data: movement,
    };
  }

  @Get('/account/:accountId')
  async findByAccountId(@Param('accountId') accountId: string) {
    const movements = await this.movementsService.findByAccountId(accountId);
    return {
      data: movements,
    };
  }
}
