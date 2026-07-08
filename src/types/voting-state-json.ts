export type VotingStateJson = {
  readonly channelId: string;
  readonly guildId: string;
  readonly isOpen: boolean;
  readonly messageId?: string;
  readonly options: string[];
  readonly votesByUserId?: Record<string, string>;
};
