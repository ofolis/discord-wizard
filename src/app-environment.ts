import { EnvironmentUtils } from "./core";
import type { AppConfig } from "./types";

export class AppEnvironment {
  private static __config: AppConfig | null = null;

  public static get config(): AppConfig {
    if (this.__config === null) {
      this.__config = {
        get chatbotEnabled(): boolean {
          return (
            EnvironmentUtils.getOptionalEnvVariable(
              "CHATBOT_ENABLED",
            ).toUpperCase() === "TRUE"
          );
        },
        get callInHostChannelName(): string {
          return EnvironmentUtils.getRequiredEnvVariable(
            "CALL_IN_HOST_CHANNEL_NAME",
          );
        },
        get callInHostRoleNames(): readonly string[] {
          return EnvironmentUtils.getRequiredEnvList("CALL_IN_HOST_ROLE_NAMES");
        },
        get openAiApiKey(): string {
          return EnvironmentUtils.getRequiredEnvVariable("OPENAI_API_KEY");
        },
        get openAiModel(): string {
          return EnvironmentUtils.getOptionalEnvVariable("OPENAI_MODEL");
        },
        get openAiPromptId(): string {
          return EnvironmentUtils.getRequiredEnvVariable("OPENAI_PROMPT_ID");
        },
        get submissionChannelName(): string {
          return EnvironmentUtils.getRequiredEnvVariable(
            "SUBMISSION_CHANNEL_NAME",
          );
        },
      };
    }
    return this.__config;
  }
}
