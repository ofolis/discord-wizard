export type AppConfig = {
  readonly callInHostChannelName: string;
  readonly callInHostRoleNames: readonly string[];
  readonly chatbotEnabled: boolean;
  readonly chatbotOrganicChannelNames: readonly string[];
  readonly chatbotOrganicCooldownMinutes: number;
  readonly chatbotOrganicReplyChance: number;
  readonly openAiApiKey: string | null;
  readonly openAiModel: string;
  readonly openAiPromptId: string | null;
  readonly submissionChannelName: string;
};
