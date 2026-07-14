import * as discordJs from "discord.js";
import { AppEnvironment } from "../app-environment";
import {
  ChannelCache,
  DataController,
  InteractionController,
} from "../controllers";
import {
  AccessUtils,
  ChannelCommandMessage,
  ChannelMessage,
  Discord,
  Log,
} from "../core";
import { CallInState } from "../saveables";

const discordUnknownMemberErrorCode: number = 10007;
const discordTargetUserNotConnectedToVoiceErrorCode: number = 40032;

export class CallInUtils {
  public static canManageCallIn(member: discordJs.GuildMember): boolean {
    return this.isHost(member) || AccessUtils.canUseRestrictedCommands(member);
  }

  public static async enforceVoiceState(
    oldState: discordJs.VoiceState,
    newState: discordJs.VoiceState,
  ): Promise<void> {
    const guildId: string = newState.guild.id;
    const callInState: CallInState | null =
      DataController.loadActiveCallInState(guildId);
    if (callInState === null) {
      return;
    }
    const member: discordJs.GuildMember | null = newState.member;
    if (member === null || member.user.bot) {
      return;
    }

    const wasInActiveChannel: boolean =
      oldState.channelId === callInState.voiceChannelId;
    const isInActiveChannel: boolean =
      newState.channelId === callInState.voiceChannelId;

    if (wasInActiveChannel && !isInActiveChannel) {
      const didQueueChange: boolean = callInState.hasQueuedUser(member.id);
      const wasBotMuted: boolean = callInState.botMutedUserIds.includes(
        member.id,
      );
      if (wasBotMuted) {
        try {
          await this.unmuteForCallIn(member, callInState);
        } catch (reason: unknown) {
          if (this.__isDiscordVoiceDisconnectedError(reason)) {
            callInState.removeBotMutedUser(member.id);
          } else {
            Log.error(
              "Could not unmute call-in member leaving channel.",
              reason,
              {
                guildId,
                userId: member.id,
              },
            );
          }
        }
      }
      callInState.removeQueuedUser(member.id);
      callInState.removeSpeakingUser(member.id);
      DataController.saveCallInState(callInState);
      if (didQueueChange) {
        await this.postQueueToHosts(newState.guild, callInState);
      }
      return;
    }

    if (
      isInActiveChannel &&
      !callInState.isEnding &&
      !this.isHost(member) &&
      !callInState.hasSpeakingUser(member.id) &&
      newState.serverMute !== true
    ) {
      await this.muteForCallIn(member, callInState);
      DataController.saveCallInState(callInState);
    }
  }

  public static async getTargetMember(
    message: ChannelCommandMessage,
    user: discordJs.User,
  ): Promise<discordJs.GuildMember | null> {
    try {
      return await message.member.guild.members.fetch(user.id);
    } catch (reason: unknown) {
      Log.error("Could not fetch call-in target member.", reason, {
        guildId: message.member.guild.id,
        userId: user.id,
      });
      return null;
    }
  }

  public static isHost(member: discordJs.GuildMember): boolean {
    return member.roles.cache.some(role =>
      AppEnvironment.config.callInHostRoleNames.includes(role.name),
    );
  }

  public static isInCallInVoiceChannel(
    member: discordJs.GuildMember,
    callInState: CallInState,
  ): boolean {
    return member.voice.channelId === callInState.voiceChannelId;
  }

  public static async muteForCallIn(
    member: discordJs.GuildMember,
    callInState: CallInState,
  ): Promise<void> {
    if (this.isHost(member)) {
      return;
    }
    if (member.voice.channelId === null) {
      return;
    }
    if (member.voice.serverMute !== true) {
      try {
        await member.voice.setMute(true, "Call-in mode");
      } catch (reason: unknown) {
        if (this.__isDiscordVoiceDisconnectedError(reason)) {
          return;
        }
        throw reason;
      }
      callInState.addBotMutedUser(member.id);
    }
  }

  public static async muteNonHostVoiceMembers(
    voiceChannel: discordJs.VoiceBasedChannel,
    callInState: CallInState,
  ): Promise<void> {
    for (const member of voiceChannel.members.values()) {
      if (member.user.bot || this.isHost(member)) {
        continue;
      }
      await this.muteForCallIn(member, callInState);
    }
  }

  public static async postQueueToHosts(
    guild: discordJs.Guild,
    callInState: CallInState,
  ): Promise<boolean> {
    const hostsChannelId: string | null =
      await this.resolveHostsChannelId(guild);
    if (hostsChannelId === null) {
      return false;
    }
    const userLabelsById: Record<string, string> =
      await this.__getUserLabelsById(guild, callInState.queuedUserIds);
    if (callInState.queueMessageId !== null) {
      try {
        await InteractionController.updateCallInQueue(
          hostsChannelId,
          callInState.queueMessageId,
          callInState,
          userLabelsById,
        );
        return true;
      } catch (reason: unknown) {
        Log.error("Could not update call-in queue post.", reason, {
          guildId: guild.id,
          messageId: callInState.queueMessageId,
        });
      }
    }
    const queueMessage: ChannelMessage =
      await InteractionController.showCallInQueue(
        hostsChannelId,
        callInState,
        userLabelsById,
      );
    callInState.queueMessageId = queueMessage.id;
    DataController.saveCallInState(callInState);
    return true;
  }

  public static async requireActiveCallInState(
    message: ChannelCommandMessage,
  ): Promise<CallInState | null> {
    const callInState: CallInState | null =
      DataController.loadActiveCallInState(message.member.guild.id);
    if (callInState === null) {
      await InteractionController.informError(
        message,
        "Call-in mode is not active.",
      );
      return null;
    }
    return callInState;
  }

  public static async requireCallInManager(
    message: ChannelCommandMessage,
  ): Promise<boolean> {
    if (this.canManageCallIn(message.member)) {
      return true;
    }
    await InteractionController.informError(
      message,
      `You need Discord administrator permission, a manager role, or one of these call-in host roles to use this command: ${AppEnvironment.config.callInHostRoleNames.map(roleName => `\`${roleName}\``).join(", ")}.`,
    );
    return false;
  }

  public static async requireNonCallInHost(
    message: ChannelCommandMessage,
  ): Promise<boolean> {
    if (!this.isHost(message.member)) {
      return true;
    }
    await InteractionController.informError(
      message,
      "Call-in hosts cannot use this command.",
    );
    return false;
  }

  public static async resolveHostsChannelId(
    guild: discordJs.Guild,
  ): Promise<string | null> {
    let channelIds: string[] = ChannelCache.getChannelIds(
      guild.id,
      AppEnvironment.config.callInHostChannelName,
    );
    if (channelIds.length !== 1) {
      try {
        await ChannelCache.cacheGuild(guild);
      } catch (reason: unknown) {
        Log.error("Could not refresh guild channel cache.", reason, {
          guildId: guild.id,
        });
        return null;
      }
      channelIds = ChannelCache.getChannelIds(
        guild.id,
        AppEnvironment.config.callInHostChannelName,
      );
    }
    if (channelIds.length !== 1) {
      Log.error("Could not resolve call-in hosts channel.", {
        channelIds,
        channelName: AppEnvironment.config.callInHostChannelName,
        guildId: guild.id,
      });
      return null;
    }
    return channelIds[0];
  }

  public static async resolveStartVoiceChannel(
    message: ChannelCommandMessage,
  ): Promise<discordJs.VoiceBasedChannel | null> {
    if (message.member.voice.channel !== null) {
      return message.member.voice.channel;
    }
    return await Discord.getVoiceChannel(message.channelId);
  }

  public static async unmuteForCallIn(
    member: discordJs.GuildMember,
    callInState: CallInState,
  ): Promise<void> {
    if (!callInState.botMutedUserIds.includes(member.id)) {
      return;
    }
    if (member.voice.channelId === null) {
      callInState.removeBotMutedUser(member.id);
      return;
    }
    if (member.voice.serverMute === true) {
      await member.voice.setMute(false, "Call-in mode");
    }
    callInState.removeBotMutedUser(member.id);
  }

  public static async unmuteTrackedMembers(
    guild: discordJs.Guild,
    callInState: CallInState,
  ): Promise<boolean> {
    let didUnmuteAll: boolean = true;
    for (const userId of [...callInState.botMutedUserIds]) {
      try {
        const member: discordJs.GuildMember = await guild.members.fetch(userId);
        await this.unmuteForCallIn(member, callInState);
      } catch (reason: unknown) {
        if (
          this.__isDiscordUnknownMemberError(reason) ||
          this.__isDiscordVoiceDisconnectedError(reason)
        ) {
          callInState.removeBotMutedUser(userId);
          continue;
        }
        didUnmuteAll = false;
        Log.error("Could not unmute call-in member.", reason, {
          guildId: guild.id,
          userId,
        });
      }
    }
    return didUnmuteAll;
  }

  private static async __getUserLabelsById(
    guild: discordJs.Guild,
    userIds: readonly string[],
  ): Promise<Record<string, string>> {
    const labelsById: Record<string, string> = {};
    for (const userId of userIds) {
      try {
        const member: discordJs.GuildMember = await guild.members.fetch(userId);
        labelsById[userId] = Discord.formatGuildMemberNameString(member);
      } catch {
        labelsById[userId] = Discord.formatUnknownUserNameString({
          id: userId,
        });
      }
    }
    return labelsById;
  }

  private static __isDiscordUnknownMemberError(reason: unknown): boolean {
    return (
      typeof reason === "object" &&
      reason !== null &&
      "code" in reason &&
      reason.code === discordUnknownMemberErrorCode
    );
  }

  private static __isDiscordVoiceDisconnectedError(reason: unknown): boolean {
    return (
      typeof reason === "object" &&
      reason !== null &&
      "code" in reason &&
      reason.code === discordTargetUserNotConnectedToVoiceErrorCode
    );
  }
}
