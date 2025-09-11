import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { Account } from '@prisma/client';

@Injectable()
export class AccountsService {
  constructor(private prisma: PrismaService) {}

  async create(createAccountDto: CreateAccountDto): Promise<Account> {
    try {
      const existingEmailAccount = await this.prisma.account.findUnique({
        where: { email: createAccountDto.email },
      });

      if (existingEmailAccount) {
        throw new ConflictException(
          'Email já está cadastrado em nosso sistema.',
        );
      }

      const existingDocumentAccount = await this.prisma.account.findUnique({
        where: { document: createAccountDto.document },
      });

      if (existingDocumentAccount) {
        throw new ConflictException(
          'Documento já está cadastrado em nosso sistema.',
        );
      }

      return await this.prisma.account.create({
        data: {
          name: createAccountDto.name,
          email: createAccountDto.email,
          document: createAccountDto.document,
          balance: createAccountDto?.balance ?? 0,
        },
      });
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
}
