import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AccountsModule } from './accounts/accounts.module';
import { MovementsModule } from './movements/movements.module';

@Module({
  imports: [AccountsModule, MovementsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
