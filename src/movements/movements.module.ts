import { Module } from '@nestjs/common';
import { MovementsController } from './movements.controller';
import { MovementsService } from './movements.service';
import { PrismaService } from '../common/prisma.service';

@Module({
  controllers: [MovementsController],
  providers: [MovementsService, PrismaService],
  exports: [MovementsService],
})
export class MovementsModule {}
