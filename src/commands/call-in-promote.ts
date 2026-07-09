import * as discordJs from "discord.js";
import { DataController, InteractionController } from "../controllers";
import {
  ChannelCommandMessage,
  Command,
  CommandOption,
  CommandOptionType,
  Discord,
  Log,
} from "../core";
import { CallInState } from "../saveables";
import { CallInUtils } from "./call-in-utils";

const userOptionName: string = "user";

export class CallInPromote implements Command {
  public readonly description: string = "Promotes a queued call-in user.";

  public readonly isGlobal: boolean = false;

  public readonly isGuild: boolean = true;

  public readonly isPrivate: boolean = true;

  public readonly name: string = "callinpromote";

  public readonly options: CommandOption[] = [
    {
      description: "The queued user to promote.",
      isRequired: true,
      name: userOptionName,
      type: CommandOptionType.USER,
    },
  ];

  public async execute(message: ChannelCommandMessage): Promise<void> {
    if (!(await CallInUtils.requireHost(message))) {
      return;
    }
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
      Log.throw("Cannot promote call-in user. User option is missing.");
    }
    if (!callInState.hasQueuedUser(user.id)) {
      await InteractionController.informError(
        message,
        "That user is not on the call-in queue.",
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
      callInState.addSpeakingUser(member.id);
      await CallInUtils.unmuteForCallIn(member, callInState);
      DataController.saveCallInState(callInState);
      if (
        !(await CallInUtils.postQueueToHosts(message.member.guild, callInState))
      ) {
        Log.throw("Could not update call-in queue for hosts.");
      }
      await InteractionController.announceCallInOnAir(callInState.channelId, {
        userMention: Discord.formatUserMentionString(member.user),
      });
    } catch (reason: unknown) {
      Log.error("Could not promote call-in user.", reason);
      await InteractionController.informError(
        message,
        "Could not promote that call-in user. Contact an admin.",
      );
      return;
    }
    await InteractionController.informSuccess(
      message,
      `${member.displayName} is live on the call.`,
    );
  }
}
