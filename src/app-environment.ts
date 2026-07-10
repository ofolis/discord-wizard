import { EnvironmentUtils } from "./core";
import type { AppConfig } from "./types";

export class AppEnvironment {
  private static __config: AppConfig | null = null;

  public static get config(): AppConfig {
    if (this.__config === null) {
      this.__config = {
        get callInHostChannelName(): string {
          return EnvironmentUtils.getRequiredEnvVariable(
            "CALL_IN_HOST_CHANNEL_NAME",
          );
        },
        get callInHostRoleNames(): readonly string[] {
          return EnvironmentUtils.getRequiredEnvList("CALL_IN_HOST_ROLE_NAMES");
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
