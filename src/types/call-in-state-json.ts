export type CallInStateJson = {
  readonly botMutedUserIds?: string[];
  readonly channelId: string;
  readonly guildId: string;
  readonly isEnding?: boolean;
  readonly isOpen: boolean;
  readonly queueMessageId?: string;
  readonly queuedUserIds?: string[];
  readonly speakingUserIds?: string[];
  readonly voiceChannelId: string;
};
