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
    }, 10000);
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

        await this.saveLedgerLog(logData);

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

  private async saveLedgerLog(
    logData: LogMessage,
    attempt: number = 1,
  ): Promise<void> {
    const maxAttempts = 3;

    try {
      const existingLog = await this.prisma.ledgerLog.findUnique({
        where: { movement_id: logData.movement_id },
      });

      if (existingLog) {
        this.logger.warn(
          `Log já existe para movement_id: ${logData.movement_id}. Parando inserção.`,
        );
        return;
      }

      await this.prisma.ledgerLog.create({
        data: {
          movement_id: logData.movement_id,
          status: logData.status,
          fail_reason: logData.fail_reason,
        },
      });

      this.logger.log(
        `Log salvo com sucesso para movement_id: ${logData.movement_id}`,
      );
    } catch (error) {
      this.logger.error(
        `Erro ao salvar log para movement_id ${logData.movement_id} na tentativa ${attempt}/${maxAttempts}:`,
        error,
      );

      if (attempt < maxAttempts) {
        this.logger.log(
          `Tentando novamente salvar log para movement_id: ${logData.movement_id} na tentativa ${attempt + 1}/${maxAttempts}`,
        );

        await this.delay(1000 * attempt);

        return await this.saveLedgerLog(logData, attempt + 1);
      } else {
        this.logger.error(
          `Falha ao salvar log após ${maxAttempts} tentativas para movement_id: ${logData.movement_id}`,
        );
        throw new NotFoundException('Erro ao processar logs. ' + error);
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
