import * as discordJs from "discord.js";
import { InteractionController } from "../controllers";
import { ChannelCommandMessage, Command, Environment } from "../core";

type AccessControlledCommand = Command & {
  readonly authorizeUse?: (message: ChannelCommandMessage) => Promise<boolean>;
};

export class AccessUtils {
  public static async authorizeCommandUse(
    command: Command,
    message: ChannelCommandMessage,
  ): Promise<boolean> {
    if (command.isAvailableToAllUsers) {
      return true;
    }
    const accessControlledCommand: AccessControlledCommand =
      command as AccessControlledCommand;
    if (accessControlledCommand.authorizeUse !== undefined) {
      return await accessControlledCommand.authorizeUse(message);
    }
    return await this.authorizeRestrictedCommandUse(message);
  }

  public static async authorizeRestrictedCommandUse(
    message: ChannelCommandMessage,
  ): Promise<boolean> {
    if (this.canUseRestrictedCommands(message.member)) {
      return true;
    }
    await InteractionController.informError(
      message,
      this.__formatManagerError(),
    );
    return false;
  }

  public static canUseRestrictedCommands(
    member: discordJs.GuildMember,
  ): boolean {
    return this.isDiscordAdministrator(member) || this.isManager(member);
  }

  public static isDiscordAdministrator(member: discordJs.GuildMember): boolean {
    return member.permissions.has(discordJs.PermissionFlagsBits.Administrator);
  }

  public static isManager(member: discordJs.GuildMember): boolean {
    return (
      Environment.config.managerRoleNames.length > 0 &&
      member.roles.cache.some(role =>
        Environment.config.managerRoleNames.includes(role.name),
      )
    );
  }

  private static __formatManagerError(): string {
    if (Environment.config.managerRoleNames.length === 0) {
      return "You need Discord administrator permission to use this command.";
    }
    return `You need Discord administrator permission or one of these manager roles to use this command: ${Environment.config.managerRoleNames.map(roleName => `\`${roleName}\``).join(", ")}.`;
  }
}
