export type AppConfig = {
  readonly callInHostChannelName: string;
  readonly callInHostRoleNames: readonly string[];
  readonly chatbotEnabled: boolean;
  readonly openAiApiKey: string;
  readonly openAiModel: string;
  readonly openAiPromptId: string;
  readonly submissionChannelName: string;
};
