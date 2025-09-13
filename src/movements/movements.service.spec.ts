/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { MovementsService } from './movements.service';
import { PrismaService } from '../common/prisma.service';
import { CreateMovementDto } from './dto/create-movement.dto';
import { MovementType, LedgerStatus } from '@prisma/client';
import * as rabbitmqPublisher from '../rabbitmq/rabbitmq.publisher';

jest.mock('../rabbitmq/rabbitmq.publisher', () => ({
  publishToQueue: jest.fn(),
}));

describe('MovementsService', () => {
  let service: MovementsService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    account: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    movement: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockAccount = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'João Silva',
    email: 'joao@example.com',
    document: '12345678901',
    credit_limit: 1000,
    balance: 500,
    created_at: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MovementsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<MovementsService>(MovementsService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Criar movimentação', () => {
    const createMovementDto: CreateMovementDto = {
      account_id: '123e4567-e89b-12d3-a456-426614174000',
      amount: 100,
      type: MovementType.CREDIT,
      description: 'Depósito teste',
    };

    const mockMovement = {
      id: 1,
      account_id: '123e4567-e89b-12d3-a456-426614174000',
      amount: 100,
      type: MovementType.CREDIT,
      status: LedgerStatus.APPROVED,
      description: 'Depósito teste',
      created_at: new Date(),
    };

    it('deve criar uma movimentação de crédito com sucesso', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue(mockAccount);
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return await callback({
          movement: {
            create:
              mockPrismaService.movement.create.mockResolvedValue(mockMovement),
          },
          account: {
            update: mockPrismaService.account.update,
          },
        });
      });

      const result = await service.create(createMovementDto);

      expect(mockPrismaService.account.findUnique).toHaveBeenCalledWith({
        where: { id: createMovementDto.account_id },
      });
      expect(rabbitmqPublisher.publishToQueue).toHaveBeenCalledWith(
        'log.pubsub',
        {
          movement_id: mockMovement.id,
          status: LedgerStatus.PROCESSED,
        },
      );
      expect(result).toEqual(mockMovement);
    });

    it('deve criar uma movimentação de débito com sucesso quando houver saldo suficiente', async () => {
      const debitMovementDto = {
        ...createMovementDto,
        type: MovementType.DEBIT,
        amount: 200,
      };

      mockPrismaService.account.findUnique.mockResolvedValue(mockAccount);
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
        return await callback({
          movement: {
            create: mockPrismaService.movement.create.mockResolvedValue({
              ...mockMovement,
              type: MovementType.DEBIT,
              amount: 200,
            }),
          },
          account: {
            update: mockPrismaService.account.update,
          },
        });
      });

      const result = await service.create(debitMovementDto);

      expect(result.type).toBe(MovementType.DEBIT);
      expect(result.amount).toBe(200);
    });

    it('deve retornar uma Exception quando a conta não for encontrada', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue(null);

      await expect(service.create(createMovementDto)).rejects.toThrow(
        new NotFoundException('Conta não encontrada.'),
      );

      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('deve bloquear movimentação de débito quando saldo insuficiente', async () => {
      const debitMovementDto = {
        ...createMovementDto,
        type: MovementType.DEBIT,
        amount: 2000,
      };

      const blockedMovement = {
        ...mockMovement,
        type: MovementType.DEBIT,
        amount: 2000,
        status: LedgerStatus.BLOCKED,
      };

      mockPrismaService.account.findUnique.mockResolvedValue(mockAccount);
      mockPrismaService.movement.create.mockResolvedValue(blockedMovement);

      await expect(service.create(debitMovementDto)).rejects.toThrow(
        new BadRequestException('Transação bloqueada, limite insuficiente.'),
      );

      expect(mockPrismaService.movement.create).toHaveBeenCalledWith({
        data: {
          account_id: debitMovementDto.account_id,
          amount: debitMovementDto.amount,
          type: debitMovementDto.type,
          status: LedgerStatus.BLOCKED,
          description: debitMovementDto.description,
        },
      });

      expect(rabbitmqPublisher.publishToQueue).toHaveBeenCalledWith(
        'log.pubsub',
        {
          movement_id: blockedMovement.id,
          status: LedgerStatus.BLOCKED,
          fail_reason: 'Transação bloqueada, limite insuficiente.',
        },
      );
    });

    it('deve tratar falhas de transação e criar movimentação com falha', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue(mockAccount);
      mockPrismaService.$transaction.mockRejectedValue(
        new Error('Transaction failed'),
      );

      const failedMovement = {
        ...mockMovement,
        status: LedgerStatus.FAILED,
      };

      mockPrismaService.movement.create.mockResolvedValue(failedMovement);

      await expect(service.create(createMovementDto)).rejects.toThrow(
        ConflictException,
      );

      expect(mockPrismaService.movement.create).toHaveBeenCalledWith({
        data: {
          account_id: createMovementDto.account_id,
          amount: createMovementDto.amount,
          type: createMovementDto.type,
          status: LedgerStatus.FAILED,
          description: createMovementDto.description,
        },
      });

      expect(rabbitmqPublisher.publishToQueue).toHaveBeenCalledWith(
        'log.pubsub',
        {
          movement_id: failedMovement.id,
          status: LedgerStatus.FAILED,
          fail_reason: 'Transação falhou. Erro interno',
        },
      );
    });
  });

  describe('Busca as movimentações de uma conta', () => {
    const accountId = '123e4567-e89b-12d3-a456-426614174000';

    const mockAccountData = {
      id: accountId,
      name: 'João Silva',
    };

    const mockMovements = [
      {
        id: 1,
        account_id: accountId,
        amount: 100,
        type: MovementType.CREDIT,
        status: LedgerStatus.PROCESSED,
        description: 'Depósito',
        created_at: new Date(),
      },
      {
        id: 2,
        account_id: accountId,
        amount: 50,
        type: MovementType.DEBIT,
        status: LedgerStatus.PROCESSED,
        description: 'Saque',
        created_at: new Date(),
      },
    ];

    it('deve retornar as movimentações de uma conta com sucesso', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue(mockAccountData);
      mockPrismaService.movement.findMany.mockResolvedValue(mockMovements);

      const result = await service.findByAccountId(accountId);

      expect(mockPrismaService.account.findUnique).toHaveBeenCalledWith({
        where: { id: accountId },
        select: {
          id: true,
          name: true,
        },
      });

      expect(mockPrismaService.movement.findMany).toHaveBeenCalledWith({
        where: { account_id: accountId },
        orderBy: { created_at: 'desc' },
      });

      expect(result).toEqual({
        account_id: mockAccountData.id,
        name: mockAccountData.name,
        movements: mockMovements,
      });
    });

    it('deve retornar uma Exception quando a conta não for encontrada', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue(null);

      await expect(service.findByAccountId(accountId)).rejects.toThrow(
        new NotFoundException('Conta não encontrada.'),
      );

      expect(mockPrismaService.movement.findMany).not.toHaveBeenCalled();
    });

    it('deve retornar um array vazio quando a conta não tiver movimentações', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue(mockAccountData);
      mockPrismaService.movement.findMany.mockResolvedValue([]);

      const result = await service.findByAccountId(accountId);

      expect(result.movements).toEqual([]);
    });
  });
});
