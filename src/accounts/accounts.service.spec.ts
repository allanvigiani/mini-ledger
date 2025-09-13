import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { PrismaService } from '../common/prisma.service';
import { CreateAccountDto } from './dto/create-account.dto';

describe('AccountsService', () => {
  let service: AccountsService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    account: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AccountsService>(AccountsService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Criar conta', () => {
    const createAccountDto: CreateAccountDto = {
      name: 'João Silva',
      email: 'joao@example.com',
      document: '12345678901',
      balance: 100,
    };

    const mockAccount = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'João Silva',
      email: 'joao@example.com',
      document: '12345678901',
      credit_limit: 1000,
      balance: 100,
      created_at: new Date(),
    };

    it('deve criar uma conta com sucesso', async () => {
      mockPrismaService.account.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.account.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.account.create.mockResolvedValue(mockAccount);

      const result = await service.create(createAccountDto);

      expect(mockPrismaService.account.findUnique).toHaveBeenCalledTimes(2);
      expect(mockPrismaService.account.findUnique).toHaveBeenNthCalledWith(1, {
        where: { email: createAccountDto.email },
      });
      expect(mockPrismaService.account.findUnique).toHaveBeenNthCalledWith(2, {
        where: { document: createAccountDto.document },
      });
      expect(mockPrismaService.account.create).toHaveBeenCalledWith({
        data: {
          name: createAccountDto.name,
          email: createAccountDto.email,
          document: createAccountDto.document,
          balance: createAccountDto.balance,
        },
      });
      expect(result).toEqual(mockAccount);
    });

    it('deve criar uma conta com saldo padrão quando não fornecido', async () => {
      const createAccountDtoWithoutBalance = { ...createAccountDto };
      delete createAccountDtoWithoutBalance.balance;

      mockPrismaService.account.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.account.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.account.create.mockResolvedValue(mockAccount);

      await service.create(createAccountDtoWithoutBalance);

      expect(mockPrismaService.account.create).toHaveBeenCalledWith({
        data: {
          name: createAccountDtoWithoutBalance.name,
          email: createAccountDtoWithoutBalance.email,
          document: createAccountDtoWithoutBalance.document,
          balance: 0,
        },
      });
    });

    it('deve retornar uma Execption de email já cadastrado.', async () => {
      mockPrismaService.account.findUnique.mockResolvedValueOnce(mockAccount);

      await expect(service.create(createAccountDto)).rejects.toThrow(
        new ConflictException('Email já está cadastrado em nosso sistema.'),
      );

      expect(mockPrismaService.account.findUnique).toHaveBeenCalledWith({
        where: { email: createAccountDto.email },
      });
      expect(mockPrismaService.account.create).not.toHaveBeenCalled();
    });

    it('deve retornar uma Execption de documento já cadastrado.', async () => {
      mockPrismaService.account.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.account.findUnique.mockResolvedValueOnce(mockAccount);

      await expect(service.create(createAccountDto)).rejects.toThrow(
        new ConflictException('Documento já está cadastrado em nosso sistema.'),
      );

      expect(mockPrismaService.account.findUnique).toHaveBeenCalledTimes(2);
      expect(mockPrismaService.account.create).not.toHaveBeenCalled();
    });

    it('deve retornar uma Execption quando ocorrer um erro no banco de dados', async () => {
      mockPrismaService.account.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.account.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.account.create.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.create(createAccountDto)).rejects.toThrow(
        new ConflictException('Erro ao criar conta'),
      );
    });
  });

  describe('Buscar todas as contas', () => {
    it('deve retornar todas as contas', async () => {
      const mockAccounts = [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'João Silva',
          email: 'joao@example.com',
          document: '12345678901',
          credit_limit: 1000,
          balance: 100,
          created_at: new Date(),
        },
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          name: 'Maria Santos',
          email: 'maria@example.com',
          document: '12345678902',
          credit_limit: 1000,
          balance: 200,
          created_at: new Date(),
        },
      ];

      mockPrismaService.account.findMany.mockResolvedValue(mockAccounts);

      const result = await service.findAll();

      expect(mockPrismaService.account.findMany).toHaveBeenCalledWith({
        orderBy: { created_at: 'desc' },
      });
      expect(result).toEqual(mockAccounts);
    });

    it('deve retornar um array vazio quando não houver contas', async () => {
      mockPrismaService.account.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('Buscar uma conta', () => {
    const accountId = '123e4567-e89b-12d3-a456-426614174000';
    const mockAccount = {
      id: accountId,
      name: 'João Silva',
      email: 'joao@example.com',
      document: '12345678901',
      credit_limit: 1000,
      balance: 100,
      created_at: new Date(),
    };

    it('deve retornar uma conta buscada pelo ID', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue(mockAccount);

      const result = await service.findOne(accountId);

      expect(mockPrismaService.account.findUnique).toHaveBeenCalledWith({
        where: { id: accountId },
      });
      expect(result).toEqual(mockAccount);
    });

    it('deve retornar uma Exception quando a conta não for encontrada', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue(null);

      await expect(service.findOne(accountId)).rejects.toThrow(
        new NotFoundException('Conta não encontrada.'),
      );
    });
  });

  describe('Buscar saldo e limite de crédito', () => {
    const accountId = '123e4567-e89b-12d3-a456-426614174000';
    const mockBalance = {
      balance: 100,
      credit_limit: 1000,
    };

    it('deve retornar o saldo e o limite de crédito de uma conta', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue(mockBalance);

      const result = await service.findBalanceAndCreditLimit(accountId);

      expect(mockPrismaService.account.findUnique).toHaveBeenCalledWith({
        where: { id: accountId },
        select: { balance: true, credit_limit: true },
      });
      expect(result).toEqual(mockBalance);
    });

    it('deve retornar uma Exception quando a conta não for encontrada', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue(null);

      await expect(
        service.findBalanceAndCreditLimit(accountId),
      ).rejects.toThrow(new NotFoundException('Conta não encontrada.'));
    });
  });
});
