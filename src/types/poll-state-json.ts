export type PollStateJson = {
  readonly channelId: string;
  readonly guildId: string;
  readonly isOpen: boolean;
  readonly options: string[];
  readonly votesByUserId: Record<string, string>;
};
