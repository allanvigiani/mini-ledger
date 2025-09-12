import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { BalanceDto } from './dto/balance.dto';
import { Account } from '@prisma/client';

@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);
  constructor(private prisma: PrismaService) {}

  async create(createAccountDto: CreateAccountDto): Promise<Account> {
    try {
      this.logger.log(
        `Processando criação de conta para o email: ${createAccountDto.email}`,
      );
      const existingEmailAccount = await this.prisma.account.findUnique({
        where: { email: createAccountDto.email },
      });

      if (existingEmailAccount) {
        this.logger.warn(
          `Tentativa de criação de conta com EMAIL JÁ EXISTENTE: ${createAccountDto.email}`,
        );
        throw new ConflictException(
          'Email já está cadastrado em nosso sistema.',
        );
      }

      const existingDocumentAccount = await this.prisma.account.findUnique({
        where: { document: createAccountDto.document },
      });

      if (existingDocumentAccount) {
        this.logger.warn(
          `Tentativa de criação de conta com DOCUMENTO JÁ EXISTENTE: ${createAccountDto.document}`,
        );
        throw new ConflictException(
          'Documento já está cadastrado em nosso sistema.',
        );
      }

      const result = await this.prisma.account.create({
        data: {
          name: createAccountDto.name,
          email: createAccountDto.email,
          document: createAccountDto.document,
          balance: createAccountDto?.balance ?? 0,
        },
      });

      this.logger.log(
        `Conta criada com SUCESSO (${result.id}}) para o email: ${createAccountDto.email}`,
      );

      return result;
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new ConflictException('Erro ao criar conta');
    }
  }

  async findAll(): Promise<Account[]> {
    return this.prisma.account.findMany({
      orderBy: { created_at: 'desc' },
    });
  }

  async findOne(id: string): Promise<Account> {
    const account = await this.prisma.account.findUnique({
      where: { id },
    });

    if (!account) {
      throw new NotFoundException('Conta não encontrada.');
    }

    return account;
  }

  async findBalanceAndCreditLimit(id: string): Promise<BalanceDto> {
    const balance = await this.prisma.account.findUnique({
      where: { id },
      select: { balance: true, credit_limit: true },
    });

    if (!balance) {
      throw new NotFoundException('Conta não encontrada.');
    }

    return balance;
  }
}
