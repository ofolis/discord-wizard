export type BettingStateJson = {
  readonly betsByUserId?: Record<
    string,
    {
      readonly amountCents: number;
      readonly letter: string;
    }
  >;
  readonly channelId: string;
  readonly guildId: string;
  readonly isLocked: boolean;
  readonly isOpen: boolean;
  readonly messageId?: string;
  readonly options: string[];
};
