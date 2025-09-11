import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpStatus,
  ValidationPipe,
  UsePipes,
} from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';

@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post('/')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async create(@Body() createAccountDto: CreateAccountDto) {
    const account = await this.accountsService.create(createAccountDto);
    return {
      message: 'Conta criada com sucesso',
      data: account,
      statusCode: HttpStatus.CREATED,
    };
  }

  @Get('/')
  async findAll() {
    const accounts = await this.accountsService.findAll();
    return {
      data: accounts,
    };
  }

  @Get('/:id')
  async findOne(@Param('id') id: string) {
    const account = await this.accountsService.findOne(id);
    return {
      data: account,
    };
  }
}
