import * as discordJs from "discord.js";
import { Discord } from "./discord";
import { ChannelCommandMessage, ChannelMessage } from "./entities";
import { AppErrorCode } from "./enums";
import { Log } from "./log";

export class InteractionUtils {
  public static buildCard(
    embedData: discordJs.EmbedData,
  ): discordJs.EmbedBuilder {
    if (
      embedData.description !== undefined &&
      embedData.description.length > Discord.embedDescriptionMaxLength
    ) {
      Log.throwError(
        AppErrorCode.DISCORD_EMBED_DESCRIPTION_TOO_LONG,
        "Cannot build Discord card. Description is too long.",
        {
          embedData,
          maxLength: Discord.embedDescriptionMaxLength,
        },
      );
    }
    return new discordJs.EmbedBuilder(embedData);
  }

  public static async createChannelCard(
    channelId: string,
    embedData: discordJs.EmbedData,
  ): Promise<ChannelMessage> {
    return await Discord.sendChannelMessage(channelId, {
      embeds: [this.buildCard(embedData)],
    });
  }

  public static async setMessageCard(
    message: ChannelCommandMessage,
    embedData: discordJs.EmbedData,
  ): Promise<void> {
    await message.update({
      embeds: [this.buildCard(embedData)],
    });
  }

  public static async updateChannelCard(
    channelId: string,
    messageId: string,
    embedData: discordJs.EmbedData,
  ): Promise<void> {
    await Discord.updateChannelMessage(channelId, messageId, {
      embeds: [this.buildCard(embedData)],
    });
  }
}
