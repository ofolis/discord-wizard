import * as discordJs from "discord.js";
import { Discord, Log } from "../core";

type GuildMembersOptions = {
  readonly forceRefresh?: boolean;
  readonly includeBots?: boolean;
};

type GuildMemberCacheEntry = {
  readonly expiresAtMs: number;
  readonly members: discordJs.GuildMember[];
};

const guildMemberCacheTtlMs: number = 5 * 60 * 1000;

export class GuildMemberController {
  private static readonly __guildMemberCacheByGuildId: Map<
    string,
    GuildMemberCacheEntry
  > = new Map();

  private static readonly __guildMemberRefreshesByGuildId: Map<
    string,
    Promise<discordJs.GuildMember[]>
  > = new Map();

  public static async getGuildMembers(
    guildId: string,
    options: GuildMembersOptions = {},
  ): Promise<discordJs.GuildMember[]> {
    const members: discordJs.GuildMember[] = await this.__getCachedGuildMembers(
      guildId,
      options,
    );
    return this.__filterGuildMembers(members, options);
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
    const cachedMembers: discordJs.GuildMember[] | null =
      options.forceRefresh === true
        ? null
        : this.__getValidCachedGuildMembers(guildId);
    if (cachedMembers !== null) {
      const cachedMemberIds: Set<string> = new Set(
        cachedMembers.map(member => member.id),
      );
      const missingUserIds: string[] = userIds.filter(
        userId => !cachedMemberIds.has(userId),
      );
      if (missingUserIds.length === 0) {
        const members: discordJs.GuildMember[] = this.__getMembersByIds(
          cachedMembers,
          userIds,
          options,
        );
        Log.debug("Discord guild members retrieved successfully.", {
          guildId,
          memberCount: members.length,
        });
        return members;
      }

      const activeRefresh: Promise<discordJs.GuildMember[]> | undefined =
        this.__guildMemberRefreshesByGuildId.get(guildId);
      const missingMembers: discordJs.GuildMember[] =
        activeRefresh === undefined
          ? await this.__fetchGuildMembersByIds(
              guildId,
              missingUserIds,
              options,
            )
          : this.__getMembersByIds(
              await activeRefresh,
              missingUserIds,
              options,
            );
      const members: discordJs.GuildMember[] = this.__getMembersByIds(
        [...cachedMembers, ...missingMembers],
        userIds,
        options,
      );
      Log.debug("Discord guild members retrieved successfully.", {
        guildId,
        memberCount: members.length,
      });
      return members;
    }

    const activeRefresh: Promise<discordJs.GuildMember[]> | undefined =
      options.forceRefresh === true
        ? undefined
        : this.__guildMemberRefreshesByGuildId.get(guildId);
    const members: discordJs.GuildMember[] =
      activeRefresh === undefined
        ? await this.__fetchGuildMembersByIds(guildId, userIds, options)
        : this.__getMembersByIds(await activeRefresh, userIds, options);
    Log.debug("Discord guild members retrieved successfully.", {
      guildId,
      memberCount: members.length,
    });
    return members;
  }

  private static async __fetchGuildMembers(
    guildId: string,
  ): Promise<discordJs.GuildMember[]> {
    Log.debug("Refreshing Discord guild member cache...", { guildId });
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

    const fetchedMembers: discordJs.GuildMember[] = members.map(
      member => member,
    );
    this.__guildMemberCacheByGuildId.set(guildId, {
      expiresAtMs: Date.now() + guildMemberCacheTtlMs,
      members: fetchedMembers,
    });
    Log.debug("Discord guild member cache refreshed successfully.", {
      guildId,
      memberCount: fetchedMembers.length,
    });
    return fetchedMembers;
  }

  private static async __fetchGuildMembersByIds(
    guildId: string,
    userIds: string[],
    options: GuildMembersOptions = {},
  ): Promise<discordJs.GuildMember[]> {
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
    return members;
  }

  private static __filterGuildMembers(
    members: discordJs.GuildMember[],
    options: GuildMembersOptions,
  ): discordJs.GuildMember[] {
    return members.filter(
      member => options.includeBots === true || !member.user.bot,
    );
  }

  private static async __getCachedGuildMembers(
    guildId: string,
    options: GuildMembersOptions,
  ): Promise<discordJs.GuildMember[]> {
    if (options.forceRefresh !== true) {
      const cachedMembers: discordJs.GuildMember[] | null =
        this.__getValidCachedGuildMembers(guildId);
      if (cachedMembers !== null) {
        Log.debug("Using cached Discord guild members.", {
          guildId,
          memberCount: cachedMembers.length,
        });
        return cachedMembers;
      }
    }

    const activeRefresh: Promise<discordJs.GuildMember[]> | undefined =
      this.__guildMemberRefreshesByGuildId.get(guildId);
    if (activeRefresh !== undefined) {
      Log.debug("Using active Discord guild member refresh.", { guildId });
      return await activeRefresh;
    }

    const refresh: Promise<discordJs.GuildMember[]> =
      this.__fetchGuildMembers(guildId);
    this.__guildMemberRefreshesByGuildId.set(guildId, refresh);
    try {
      return await refresh;
    } finally {
      this.__guildMemberRefreshesByGuildId.delete(guildId);
    }
  }

  private static __getMembersByIds(
    members: discordJs.GuildMember[],
    userIds: string[],
    options: GuildMembersOptions,
  ): discordJs.GuildMember[] {
    const membersById: Map<string, discordJs.GuildMember> = new Map(
      this.__filterGuildMembers(members, options).map(member => [
        member.id,
        member,
      ]),
    );
    return userIds.flatMap(userId => {
      const member: discordJs.GuildMember | undefined = membersById.get(userId);
      return member === undefined ? [] : [member];
    });
  }

  private static __getValidCachedGuildMembers(
    guildId: string,
  ): discordJs.GuildMember[] | null {
    const cacheEntry: GuildMemberCacheEntry | undefined =
      this.__guildMemberCacheByGuildId.get(guildId);
    if (cacheEntry === undefined) {
      return null;
    }
    if (cacheEntry.expiresAtMs <= Date.now()) {
      this.__guildMemberCacheByGuildId.delete(guildId);
      return null;
    }
    return cacheEntry.members;
  }
}
