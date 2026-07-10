import * as discordJs from "discord.js";
import { DataController, InteractionController } from "../controllers";
import {
  ChannelCommandMessage,
  Command,
  CommandOption,
  CommandOptionType,
  CommandRegistrationType,
  Discord,
  Log,
} from "../core";
import { CallInState } from "../saveables";
import { CallInUtils } from "./call-in-utils";

const userOptionName: string = "user";

export class CallInForce implements Command {
  public readonly description: string = "Makes a voice user live on the call.";

  public readonly isAvailableToAllUsers: boolean = false;

  public readonly name: string = "callinforce";

  public readonly options: CommandOption[] = [
    {
      description: "The voice user to make live.",
      isRequired: true,
      name: userOptionName,
      type: CommandOptionType.USER,
    },
  ];

  public readonly registrationType: CommandRegistrationType =
    CommandRegistrationType.GUILD;

  public readonly shouldReplyPrivately: boolean = true;

  public async authorizeUse(message: ChannelCommandMessage): Promise<boolean> {
    return await CallInUtils.requireCallInManager(message);
  }

  public async execute(message: ChannelCommandMessage): Promise<void> {
    const callInState: CallInState | null =
      await CallInUtils.requireActiveCallInState(message);
    if (callInState === null) {
      return;
    }
    const user: discordJs.User | undefined = message.getCommandOption(
      userOptionName,
      CommandOptionType.USER,
    );
    if (user === undefined) {
      Log.throw("Cannot force call-in. User option is missing.");
    }
    const member: discordJs.GuildMember | null =
      await CallInUtils.getTargetMember(message, user);
    if (
      member === null ||
      !CallInUtils.isInCallInVoiceChannel(member, callInState)
    ) {
      await InteractionController.informError(
        message,
        "That user is not in the active call-in voice channel.",
      );
      return;
    }
    if (
      member.voice.serverMute === true &&
      !callInState.botMutedUserIds.includes(member.id)
    ) {
      await InteractionController.informError(
        message,
        "That user is server muted outside of call-in mode.",
      );
      return;
    }

    const wasQueued: boolean = callInState.hasQueuedUser(member.id);
    try {
      callInState.addSpeakingUser(member.id);
      await CallInUtils.unmuteForCallIn(member, callInState);
      DataController.saveCallInState(callInState);
      if (wasQueued) {
        if (
          !(await CallInUtils.postQueueToHosts(
            message.member.guild,
            callInState,
          ))
        ) {
          Log.throw("Could not update call-in queue for hosts.");
        }
      }
      await InteractionController.announceCallInOnAir(callInState.channelId, {
        userMention: Discord.formatUserMentionString(member.user),
      });
    } catch (reason: unknown) {
      Log.error("Could not force call-in user live.", reason);
      await InteractionController.informError(
        message,
        "Could not make that user live on the call. Contact an admin.",
      );
      return;
    }
    await InteractionController.informSuccess(
      message,
      `${Discord.formatGuildMemberNameString(member)} is live on the call.`,
    );
  }
}
