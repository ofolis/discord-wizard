export type CallInStateJson = {
  readonly botMutedUserIds?: string[];
  readonly channelId: string;
  readonly guildId: string;
  readonly isOpen: boolean;
  readonly queuedUserIds?: string[];
  readonly speakingUserIds?: string[];
  readonly voiceChannelId: string;
};
