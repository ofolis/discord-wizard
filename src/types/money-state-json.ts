export type MoneyStateJson = {
  readonly balancesByUserId?: Record<string, number>;
  readonly guildId: string;
};
