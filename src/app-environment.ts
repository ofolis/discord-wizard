import { EnvironmentUtils } from "./core";
import type { AppConfig } from "./types";

export class AppEnvironment {
  private static __config: AppConfig | null = null;

  public static get config(): AppConfig {
    if (this.__config === null) {
      this.__config = {
        callInHostChannelName: EnvironmentUtils.getRequiredEnvVariable(
          "CALL_IN_HOST_CHANNEL_NAME",
        ),
        callInHostRoleNames: EnvironmentUtils.getRequiredEnvList(
          "CALL_IN_HOST_ROLE_NAMES",
        ),
        submissionChannelName: EnvironmentUtils.getRequiredEnvVariable(
          "SUBMISSION_CHANNEL_NAME",
        ),
      };
    }
    return this.__config;
  }
}
