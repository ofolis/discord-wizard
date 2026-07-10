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

export class CallInDemote implements Command {
  public readonly description: string = "Demotes a live call-in user.";

  public readonly isAvailableToAllUsers: boolean = false;

  public readonly name: string = "callindemote";

  public readonly options: CommandOption[] = [
    {
      description: "The live user to demote.",
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
      await InteractionController.informError(
        message,
        "Choose a user to demote.",
      );
      return;
    }
    if (!callInState.hasSpeakingUser(user.id)) {
      await InteractionController.informError(
        message,
        "That user is not live on the call.",
      );
      return;
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

    try {
      callInState.removeSpeakingUser(member.id);
      await CallInUtils.muteForCallIn(member, callInState);
      DataController.saveCallInState(callInState);
      await InteractionController.announceCallInOffAir(callInState.channelId, {
        userName: Discord.formatGuildMemberNameString(member),
      });
    } catch (reason: unknown) {
      Log.error("Could not demote call-in user.", reason);
      await InteractionController.informError(
        message,
        "Could not demote that call-in user. Contact an admin.",
      );
      return;
    }
    await InteractionController.informSuccess(
      message,
      `${Discord.formatGuildMemberNameString(member)} was demoted.`,
    );
  }
}
