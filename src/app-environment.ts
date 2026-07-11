import { EnvironmentUtils, Log } from "./core";
import type { AppConfig } from "./types";

export class AppEnvironment {
  private static __config: AppConfig | null = null;

  public static get config(): AppConfig {
    if (this.__config === null) {
      this.__config = {
        get chatbotEnabled(): boolean {
          return (
            EnvironmentUtils.getOptionalEnvVariable("CHATBOT_ENABLED")
              .trim()
              .toUpperCase() === "TRUE"
          );
        },
        get chatbotOrganicChannelNames(): readonly string[] {
          return EnvironmentUtils.getOptionalEnvList(
            "CHATBOT_ORGANIC_CHANNEL_NAMES",
          );
        },
        get chatbotOrganicCooldownMinutes(): number {
          return AppEnvironment.__getOptionalNumberEnvVariable({
            defaultValue: 60,
            key: "CHATBOT_ORGANIC_COOLDOWN_MINUTES",
            minimumValue: 0,
          });
        },
        get chatbotOrganicReplyChance(): number {
          return AppEnvironment.__getOptionalNumberEnvVariable({
            defaultValue: 0.01,
            key: "CHATBOT_ORGANIC_REPLY_CHANCE",
            maximumValue: 1,
            minimumValue: 0,
          });
        },
        get callInHostChannelName(): string {
          return EnvironmentUtils.getRequiredEnvVariable(
            "CALL_IN_HOST_CHANNEL_NAME",
          );
        },
        get callInHostRoleNames(): readonly string[] {
          return EnvironmentUtils.getRequiredEnvList("CALL_IN_HOST_ROLE_NAMES");
        },
        get openAiApiKey(): string | null {
          return AppEnvironment.__getOptionalNullableEnvVariable(
            "OPENAI_API_KEY",
          );
        },
        get openAiModel(): string | null {
          return AppEnvironment.__getOptionalNullableEnvVariable(
            "OPENAI_MODEL",
          );
        },
        get openAiPromptId(): string | null {
          return AppEnvironment.__getOptionalNullableEnvVariable(
            "OPENAI_PROMPT_ID",
          );
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

  public static validateConfig(): void {
    if (!this.config.chatbotEnabled) {
      return;
    }
    if (this.config.openAiApiKey === null) {
      Log.throw("Missing required chatbot environment variable.", {
        key: "OPENAI_API_KEY",
      });
    }
    if (this.config.openAiModel === null) {
      Log.throw("Missing required chatbot environment variable.", {
        key: "OPENAI_MODEL",
      });
    }
    if (this.config.openAiPromptId === null) {
      Log.throw("Missing required chatbot environment variable.", {
        key: "OPENAI_PROMPT_ID",
      });
    }
    void this.config.chatbotOrganicCooldownMinutes;
    void this.config.chatbotOrganicReplyChance;
  }

  private static __getOptionalNullableEnvVariable(key: string): string | null {
    const value: string = EnvironmentUtils.getOptionalEnvVariable(key).trim();
    return value.length > 0 ? value : null;
  }

  private static __getOptionalNumberEnvVariable(options: {
    readonly defaultValue: number;
    readonly key: string;
    readonly maximumValue?: number;
    readonly minimumValue?: number;
  }): number {
    const { defaultValue, key, maximumValue, minimumValue } = options;
    const value: string = EnvironmentUtils.getOptionalEnvVariable(key);
    if (value.length === 0) {
      return defaultValue;
    }
    const parsedValue: number = Number(value);
    if (!Number.isFinite(parsedValue)) {
      Log.throw("Cannot get numeric environment variable. Value is invalid.", {
        key,
        value,
      });
    }
    if (minimumValue !== undefined && parsedValue < minimumValue) {
      Log.throw(
        "Cannot get numeric environment variable. Value is too small.",
        {
          key,
          minimumValue,
          value,
        },
      );
    }
    if (maximumValue !== undefined && parsedValue > maximumValue) {
      Log.throw(
        "Cannot get numeric environment variable. Value is too large.",
        {
          key,
          maximumValue,
          value,
        },
      );
    }
    return parsedValue;
  }
}
