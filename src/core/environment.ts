import { MersenneTwister19937, Random } from "random-js";
import * as packageJson from "../../package.json";
import { Log } from "../core";
import { EnvironmentUtils } from "./environment-utils";
import type { Config, PackageContext } from "./types";

export class Environment {
  private static __config: Config | null = null;

  private static __packageContext: PackageContext | null = null;

  private static readonly __random: Random = new Random(
    MersenneTwister19937.autoSeed(),
  );

  public static get config(): Config {
    if (this.__config === null) {
      this.__config = {
        devMode:
          EnvironmentUtils.getOptionalEnvVariable("DEV_MODE").toUpperCase() ===
          "TRUE",
        discordApplicationId: EnvironmentUtils.getRequiredEnvVariable(
          "DISCORD_APPLICATION_ID",
        ),
        discordBotToken:
          EnvironmentUtils.getRequiredEnvVariable("DISCORD_BOT_TOKEN"),
        managerRoleNames:
          EnvironmentUtils.getOptionalEnvList("MANAGER_ROLE_NAMES"),
      };
    }
    return this.__config;
  }

  public static get dataPath(): string {
    return `${process.cwd()}/data`;
  }

  public static get packageContext(): PackageContext {
    if (this.__packageContext === null) {
      this.__packageContext = {
        name: this.__getPackageJsonProperty("name", true) as string,
        version: this.__getPackageJsonProperty("version", false) as
          | string
          | undefined,
      };
    }
    return this.__packageContext;
  }

  public static get random(): Random {
    return this.__random;
  }

  private static __getPackageJsonProperty(
    key: string,
    required: boolean,
  ): unknown {
    if (key in packageJson) {
      return (packageJson as Record<string, unknown>)[key];
    }
    if (required) {
      Log.throw(
        "Cannot get package.json property. Requested key was not defined.",
        {
          packageJson,
          key,
        },
      );
    }
    return undefined;
  }
}
