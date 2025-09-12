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

      if (message && channel) {
        const content = message.content.toString();
        const logData = JSON.parse(content);

        const attempts = message.properties.headers?.attempts || 0;
        const maxAttempts = 3;

        this.logger.log(
          `Processando mensagem para movement_id: ${logData.movement_id} na tentativa ${attempts + 1}/${maxAttempts}`,
        );

        try {
          await this.saveLedgerLog(logData);

          channel.ack(message);
          this.logger.log(
            `Log salvo com sucesso para movement_id: ${logData.movement_id}`,
          );
        } catch (error) {
          this.logger.error(
            `Erro ao salvar log para movement_id ${logData.movement_id} na tentativa ${attempts + 1}/${maxAttempts}:`,
            error,
          );

          if (attempts < maxAttempts - 1) {
            this.logger.log(
              `Reenviando mensagem para tentativa ${attempts + 2}/${maxAttempts}`,
            );

            // Incrementar contador de tentativas e publica novamente na fila
            const newHeaders = {
              ...message.properties.headers,
              attempts: attempts + 1,
            };

            await channel.publish('', 'log.pubsub', message.content, {
              headers: newHeaders,
              persistent: true,
            });

            channel.ack(message);
          } else {
            this.logger.error(
              `Esgotadas as ${maxAttempts} tentativas para movement_id: ${logData.movement_id}. Rejeitando mensagem.`,
            );
            channel.nack(message, false, false);
          }
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

  private async saveLedgerLog(logData: LogMessage): Promise<void> {
    const existingLog = await this.prisma.ledgerLog.findUnique({
      where: { movement_id: logData.movement_id },
    });

    if (existingLog) {
      this.logger.warn(
        `Log já existe para movement_id: ${logData.movement_id}`,
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
  }
}
