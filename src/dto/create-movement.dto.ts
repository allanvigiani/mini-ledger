export class CreateMovementDto {
  accountId: string;
  amount: number;
  type: 'CREDIT' | 'DEBIT';
  description?: string;
}