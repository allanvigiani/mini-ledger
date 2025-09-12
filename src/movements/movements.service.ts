import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateMovementDto } from './dto/create-movement.dto';
import { AccountMovementsDto } from './dto/account-movements.dto';
import { Movement, MovementType, LedgerStatus } from '@prisma/client';
import { publishToQueue } from '../rabbitmq/rabbitmq.publisher';

@Injectable()
export class MovementsService {
  private readonly logger = new Logger(MovementsService.name);
  constructor(private prisma: PrismaService) {}

  async create(createMovementDto: CreateMovementDto): Promise<Movement> {
    this.logger.log(
      `Processando criação de movimentação para a conta de ID: ${createMovementDto.account_id}`,
    );
    const account = await this.prisma.account.findUnique({
      where: { id: createMovementDto.account_id },
    });

    if (!account) {
      this.logger.warn(
        `Conta não encontrada para ID: ${createMovementDto.account_id}`,
      );
      throw new NotFoundException('Conta não encontrada.');
    }

    if (createMovementDto.type === MovementType.DEBIT) {
      this.logger.log(
        `Verificando saldo disponível para DÉBITO na conta ID: ${createMovementDto.account_id}`,
      );
      const availableBalance = account.balance + account.credit_limit;

      if (createMovementDto.amount > availableBalance) {
        const otherMovement = await this.prisma.movement.create({
          data: {
            account_id: createMovementDto.account_id,
            amount: createMovementDto.amount,
            type: createMovementDto.type,
            status: LedgerStatus.BLOCKED,
            description: createMovementDto.description,
          },
        });

        this.logger.log(
          `Movimentação bloqueada por LIMITE INSUFICIENTE para a conta ID: ${createMovementDto.account_id}. Enviando informações para a fila de Logs.`,
        );

        const otherMessage = {
          movement_id: otherMovement.id,
          status: LedgerStatus.BLOCKED,
          fail_reason: 'Transação bloqueada, limite insuficiente.',
        };
        await publishToQueue('log.pubsub', otherMessage);
        throw new BadRequestException(
          `Transação bloqueada, limite insuficiente.`,
        );
      }
    }

    const newBalance =
      createMovementDto.type === MovementType.CREDIT
        ? account.balance + createMovementDto.amount
        : account.balance - createMovementDto.amount;

    try {
      const result = await this.prisma.$transaction(async (prisma) => {
        const movement = await prisma.movement.create({
          data: {
            account_id: createMovementDto.account_id,
            amount: createMovementDto.amount,
            type: createMovementDto.type,
            status: LedgerStatus.APPROVED,
            description: createMovementDto.description,
          },
        });

        await prisma.account.update({
          where: { id: createMovementDto.account_id },
          data: { balance: newBalance },
        });

        return movement;
      });

      this.logger.log(
        `Movimentação CONCLUÍDA para a conta ID: ${createMovementDto.account_id}. Enviando informações para a fila de Logs.`,
      );

      const message = {
        movement_id: result.id,
        status: LedgerStatus.PROCESSED,
      };

      await publishToQueue('log.pubsub', message);

      return result;
    } catch (error) {
      const failedMovement = await this.prisma.movement.create({
        data: {
          account_id: createMovementDto.account_id,
          amount: createMovementDto.amount,
          type: createMovementDto.type,
          status: LedgerStatus.FAILED,
          description: createMovementDto.description,
        },
      });

      const failedMessage = {
        movement_id: failedMovement.id,
        status: LedgerStatus.FAILED,
        fail_reason: 'Transação falhou. Erro interno',
      };
      await publishToQueue('log.pubsub', failedMessage);

      throw new ConflictException('Erro ao processar movimentação. ' + error);
    }
  }

  async findByAccountId(accountId: string): Promise<AccountMovementsDto> {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      select: {
        id: true,
        name: true,
      },
    });

    if (!account) {
      throw new NotFoundException('Conta não encontrada.');
    }

    const movements = await this.prisma.movement.findMany({
      where: { account_id: accountId },
      orderBy: { created_at: 'desc' },
    });

    return {
      account_id: account.id,
      name: account.name,
      movements: movements,
    };
  }
}
