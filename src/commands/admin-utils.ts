import * as discordJs from "discord.js";
import { InteractionController } from "../controllers";
import { ChannelCommandMessage } from "../core";

export class AdminUtils {
  public static async requireAdministrator(
    message: ChannelCommandMessage,
  ): Promise<boolean> {
    if (
      message.member.permissions.has(
        discordJs.PermissionFlagsBits.Administrator,
      )
    ) {
      return true;
    }
    await InteractionController.informError(
      message,
      "You need administrator permission to use this command.",
    );
    return false;
  }
}
