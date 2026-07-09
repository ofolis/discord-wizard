import * as discordJs from "discord.js";
import { Discord, Log } from "../core";

type GuildMembersOptions = {
  readonly includeBots?: boolean;
};

export class GuildMemberController {
  public static async getGuildMembers(
    guildId: string,
    options: GuildMembersOptions = {},
  ): Promise<discordJs.GuildMember[]> {
    Log.debug("Retrieving Discord guild members...", { guildId, options });
    const guild: discordJs.Guild = await Discord.client.guilds.fetch(guildId);
    const members: discordJs.Collection<string, discordJs.GuildMember> =
      new discordJs.Collection();
    let after: string | undefined;
    let page: discordJs.Collection<string, discordJs.GuildMember>;
    do {
      page = await guild.members.list({
        after,
        cache: false,
        limit: 1000,
      });
      page.forEach(member => {
        members.set(member.id, member);
      });
      after = page.last()?.id;
    } while (page.size === 1000 && after !== undefined);

    const filteredMembers: discordJs.GuildMember[] = members
      .filter(member => options.includeBots === true || !member.user.bot)
      .map(member => member);
    Log.debug("Discord guild members retrieved successfully.", {
      guildId,
      memberCount: filteredMembers.length,
    });
    return filteredMembers;
  }

  public static async getGuildMembersByIds(
    guildId: string,
    userIds: string[],
    options: GuildMembersOptions = {},
  ): Promise<discordJs.GuildMember[]> {
    Log.debug("Retrieving Discord guild members by id...", {
      guildId,
      options,
      userIds,
    });
    const guild: discordJs.Guild = await Discord.client.guilds.fetch(guildId);
    const members: discordJs.GuildMember[] = [];
    for (const userId of userIds) {
      try {
        const member: discordJs.GuildMember = await guild.members.fetch({
          cache: false,
          force: true,
          user: userId,
        });
        if (options.includeBots === true || !member.user.bot) {
          members.push(member);
        }
      } catch (reason: unknown) {
        Log.debug("Discord guild member was not found.", {
          guildId,
          reason,
          userId,
        });
      }
    }
    Log.debug("Discord guild members retrieved successfully.", {
      guildId,
      memberCount: members.length,
    });
    return members;
  }
}
