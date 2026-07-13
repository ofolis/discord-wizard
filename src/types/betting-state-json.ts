type BettingStateJsonBet = {
  readonly amountCents: number;
  readonly letter: string;
};

export type BettingStateJson = {
  readonly betsByUserId?: Record<
    string,
    BettingStateJsonBet | Record<string, BettingStateJsonBet>
  >;
  readonly channelId: string;
  readonly guildId: string;
  readonly isLocked: boolean;
  readonly isOpen: boolean;
  readonly messageId?: string;
  readonly options: string[];
};
