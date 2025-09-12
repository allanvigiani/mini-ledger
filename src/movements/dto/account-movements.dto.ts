import { Movement } from '@prisma/client';

export interface AccountMovementsDto {
  account_id: string;
  name: string;
  movements: Movement[];
}
