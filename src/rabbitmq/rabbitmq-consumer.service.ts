/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import * as amqp from 'amqplib';
import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { LedgerStatus } from '@prisma/client';

interface LogMessage {
  movement_id: number;
  status: LedgerStatus;
  fail_reason?: string;
}

@Injectable()
export class RabbitMQConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQConsumerService.name);
  private intervalId: NodeJS.Timeout | null = null;

  constructor(private prisma: PrismaService) {}

  onModuleInit() {
    this.startConsumer();
  }

  onModuleDestroy() {
    this.stopConsumer();
  }

  private startConsumer() {
    this.intervalId = setInterval(() => {
      void this.consumeLogQueue();
    }, 10000); // 10 segundos
  }

  private stopConsumer() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async consumeLogQueue() {
    let connection: any;
    let channel: any;

    try {
      connection = await amqp.connect('amqp://guest:guest@rabbitmq:5672');
      channel = await connection.createChannel();

      if (channel) {
        await channel.assertQueue('log.pubsub', { durable: true });
      }

      const message = channel ? await channel.get('log.pubsub') : undefined;

      if (message) {
        const content = message.content.toString();
        const logData = JSON.parse(content) as LogMessage;

        await this.saveLadgerLog(logData);

        if (channel) {
          channel.ack(message);
        }
      }
    } catch (error) {
      this.logger.error('Erro ao consumir mensagem da fila:', error);
    } finally {
      if (channel) {
        try {
          await channel.close();
        } catch (error) {
          this.logger.error('Erro ao fechar canal RabbitMQ:', error);
        }
      }
      if (connection) {
        try {
          await connection.close();
        } catch (error) {
          this.logger.error('Erro ao fechar conexão RabbitMQ:', error);
        }
      }
    }
  }

  private async saveLadgerLog(logData: LogMessage) {
    try {
      const existingLog = await this.prisma.ledgerLog.findUnique({
        where: { movement_id: logData.movement_id },
      });

      if (existingLog) {
        return;
      }

      await this.prisma.ledgerLog.create({
        data: {
          movement_id: logData.movement_id,
          status: logData.status,
          fail_reason: logData.fail_reason,
        },
      });
    } catch (error) {
      throw new NotFoundException('Erro ao processar logs. ' + error);
    }
  }
}
