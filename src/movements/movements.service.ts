import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateMovementDto } from './dto/create-movement.dto';
import { Movement, MovementType } from '@prisma/client';

@Injectable()
export class MovementsService {
  constructor(private prisma: PrismaService) {}

  async create(createMovementDto: CreateMovementDto): Promise<Movement> {
    const account = await this.prisma.account.findUnique({
      where: { id: createMovementDto.account_id },
    });

    if (!account) {
      throw new NotFoundException('Conta não encontrada.');
    }

    if (createMovementDto.type === MovementType.DEBIT) {
      const availableBalance = account.balance + account.credit_limit;

      if (createMovementDto.amount > availableBalance) {
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
            description: createMovementDto.description,
          },
          include: {
            account: true,
          },
        });

        await prisma.account.update({
          where: { id: createMovementDto.account_id },
          data: { balance: newBalance },
        });

        return movement;
      });

      return result;
    } catch (error) {
      console.error('Erro ao criar movimento:', error);
      throw new ConflictException('Erro ao processar movimentação');
    }
  }

  async findByAccountId(accountId: string): Promise<Movement[]> {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundException('Conta não encontrada.');
    }

    // Melhorar forma de retorno {account_id, name, movements: []}
    const movements = await this.prisma.movement.findMany({
      where: { account_id: accountId },
      orderBy: { created_at: 'desc' },
      include: {
        account: {
          select: {
            name: true,
          },
        },
      },
    });

    if (movements.length === 0) {
      throw new NotFoundException(
        'Nenhuma movimentação encontrada para esta conta.',
      );
    }

    return movements;
  }
}
