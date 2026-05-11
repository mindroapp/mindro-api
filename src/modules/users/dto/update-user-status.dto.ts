import { IsEnum } from 'class-validator';
import { AccountStatus } from '../enums/account-status.enum';

export class UpdateUserStatusDto {
  @IsEnum(AccountStatus)
  status: AccountStatus;
}
