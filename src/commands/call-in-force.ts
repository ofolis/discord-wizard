import * as discordJs from "discord.js";
import { DataController, InteractionController } from "../controllers";
import {
  ChannelCommandMessage,
  Command,
  CommandOption,
  CommandOptionType,
  Log,
} from "../core";
import { CallInState } from "../saveables";
import { CallInUtils } from "./call-in-utils";

const userOptionName: string = "user";

export class CallInForce implements Command {
  public readonly description: string = "Makes a voice user live on the call.";

  public readonly isGlobal: boolean = false;

  public readonly isGuild: boolean = true;

  public readonly isPrivate: boolean = true;

  public readonly name: string = "callinforce";

  public readonly options: CommandOption[] = [
    {
      description: "The voice user to make live.",
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

    try {
      callInState.addSpeakingUser(member.id);
      await CallInUtils.unmuteForCallIn(member, callInState);
      DataController.saveCallInState(callInState);
      await CallInUtils.postQueueToHosts(message.member.guild, callInState);
      await InteractionController.announceCallInAnswer(callInState.channelId, {
        userName: member.displayName,
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
      `${member.displayName} is live on the call.`,
    );
  }
}
