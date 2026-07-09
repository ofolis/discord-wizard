export type Config = {
  readonly callInHostRoleNames: readonly string[];
  readonly callInHostsChannelName: string;
  readonly devMode: boolean;
  readonly discordApplicationId: string;
  readonly discordBotToken: string;
};
