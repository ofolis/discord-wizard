import dotenv from "dotenv";
import { Log } from "./core";
import type { AppConfig } from "./types";

export class AppEnvironment {
  private static __config: AppConfig | null = null;

  public static get config(): AppConfig {
    if (this.__config === null) {
      dotenv.config();
      this.__config = {
        callInHostChannelName: this.__getRequiredEnvVariable(
          "CALL_IN_HOST_CHANNEL_NAME",
        ),
        callInHostRoleNames: this.__getRequiredEnvList(
          "CALL_IN_HOST_ROLE_NAMES",
        ),
        submissionChannelName: this.__getRequiredEnvVariable(
          "SUBMISSION_CHANNEL_NAME",
        ),
      };
    }
    return this.__config;
  }

  private static __getEnvList(value: string): string[] {
    return value
      .split(",")
      .map(value => value.trim())
      .filter(value => value.length > 0);
  }

  private static __getEnvVariable(key: string, required: boolean): string {
    const value: string | undefined = process.env[key];
    if (value === undefined) {
      if (!required) {
        return "";
      }
      Log.throw(
        "Cannot get app environment variable. Requested key was not defined.",
        {
          env: process.env,
          key,
        },
      );
    }
    return value;
  }

  private static __getRequiredEnvList(key: string): string[] {
    const parsedValues: string[] = this.__getEnvList(
      this.__getEnvVariable(key, true),
    );
    if (parsedValues.length === 0) {
      Log.throw(
        "Cannot get app environment variable list. Requested key was not defined or had no values.",
        { key },
      );
    }
    return parsedValues;
  }

  private static __getRequiredEnvVariable(key: string): string {
    const value: string = this.__getEnvVariable(key, true);
    if (value.length === 0) {
      Log.throw(
        "Cannot get app environment variable. Requested key was defined but empty.",
        { key },
      );
    }
    return value;
  }
}
