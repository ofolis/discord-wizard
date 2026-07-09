import dotenv from "dotenv";
import { Log } from "./log";
import { Utils } from "./utils";

export class EnvironmentUtils {
  private static __didLoadDotEnv: boolean = false;

  public static getOptionalEnvList(key: string): string[] {
    return Utils.parseCommaSeparatedList(this.getOptionalEnvVariable(key));
  }

  public static getOptionalEnvVariable(key: string): string {
    return this.__getEnvVariable(key, false);
  }

  public static getRequiredEnvList(key: string): string[] {
    const parsedValues: string[] = Utils.parseCommaSeparatedList(
      this.getRequiredEnvVariable(key),
    );
    if (parsedValues.length === 0) {
      Log.throw(
        "Cannot get environment variable list. Requested key was not defined or had no values.",
        { key },
      );
    }
    return parsedValues;
  }

  public static getRequiredEnvVariable(key: string): string {
    const value: string = this.__getEnvVariable(key, true);
    if (value.length === 0) {
      Log.throw(
        "Cannot get environment variable. Requested key was defined but empty.",
        { key },
      );
    }
    return value;
  }

  private static __getEnvVariable(key: string, required: boolean): string {
    this.__loadDotEnv();
    const value: string | undefined = process.env[key];
    if (value === undefined) {
      if (!required) {
        return "";
      }
      Log.throw(
        "Cannot get environment variable. Requested key was not defined.",
        {
          env: process.env,
          key,
        },
      );
    }
    return value;
  }

  private static __loadDotEnv(): void {
    if (this.__didLoadDotEnv) {
      return;
    }
    dotenv.config();
    this.__didLoadDotEnv = true;
  }
}
