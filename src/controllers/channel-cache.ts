import * as discordJs from "discord.js";
import { Log } from "../core";

export class ChannelCache {
  private static readonly __channelIdsByGuildIdByChannelName: Map<
    string,
    Map<string, string[]>
  > = new Map();

  public static async cacheGuild(guild: discordJs.Guild): Promise<void> {
    Log.debug("Caching guild channels...", { guild });
    const channels: discordJs.Collection<
      string,
      discordJs.GuildBasedChannel | null
    > = await guild.channels.fetch();
    const channelIdsByName: Map<string, string[]> = new Map();
    channels.forEach(channel => {
      if (
        channel === null ||
        channel.type !== discordJs.ChannelType.GuildText
      ) {
        return;
      }
      const channelIds: string[] = channelIdsByName.get(channel.name) ?? [];
      channelIds.push(channel.id);
      channelIdsByName.set(channel.name, channelIds);
    });
    this.__channelIdsByGuildIdByChannelName.set(guild.id, channelIdsByName);
    Log.debug("Guild channels cached successfully.", {
      channelIdsByName,
      guild,
    });
  }

  public static async cacheGuilds(
    guilds: Iterable<discordJs.Guild>,
  ): Promise<void> {
    for (const guild of guilds) {
      try {
        await this.cacheGuild(guild);
      } catch (reason: unknown) {
        Log.error("Could not cache guild channels.", reason, { guild });
      }
    }
  }

  public static getChannelIds(guildId: string, channelName: string): string[] {
    return [
      ...(this.__channelIdsByGuildIdByChannelName
        .get(guildId)
        ?.get(channelName) ?? []),
    ];
  }

  public static removeGuild(guildId: string): void {
    this.__channelIdsByGuildIdByChannelName.delete(guildId);
  }
}
