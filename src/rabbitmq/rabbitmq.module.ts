import { Module } from '@nestjs/common';
import { RabbitMQConsumerService } from './rabbitmq-consumer.service';
import { PrismaService } from '../common/prisma.service';

@Module({
  providers: [RabbitMQConsumerService, PrismaService],
  exports: [RabbitMQConsumerService],
})
export class RabbitMQModule {}
