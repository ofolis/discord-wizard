import { codeBlock, escapeCodeBlock } from "discord.js";
import { AppEnvironment } from "../app-environment";
import { ChannelCache, InteractionController } from "../controllers";
import {
  AppError,
  AppErrorCode,
  ChannelCommandMessage,
  Command,
  CommandOption,
  CommandOptionType,
  CommandRegistrationType,
  Log,
} from "../core";

const messageOptionName: string = "message";

export class Submit implements Command {
  public readonly description: string = "Makes an anonymous submission.";

  public readonly isAvailableToAllUsers: boolean = true;

  public readonly name: string = "submit";

  public readonly options: CommandOption[] = [
    {
      description: "The message to submit anonymously.",
      isRequired: true,
      name: messageOptionName,
      type: CommandOptionType.STRING,
    },
  ];

  public readonly registrationType: CommandRegistrationType =
    CommandRegistrationType.GUILD;

  public readonly shouldReplyPrivately: boolean = true;

  public async execute(message: ChannelCommandMessage): Promise<void> {
    const submittedMessage: string | undefined = message.getCommandOption(
      messageOptionName,
      CommandOptionType.STRING,
    );
    if (submittedMessage === undefined) {
      Log.throw("Cannot submit anonymous message. Message option is missing.");
    }
    const submissionChannelId: string | null =
      await this.__getSubmissionChannelId(message);
    if (submissionChannelId === null) {
      await InteractionController.informError(
        message,
        `Could not find exactly one \`${AppEnvironment.config.submissionChannelName}\` text channel. Contact an admin.`,
      );
      return;
    }
    try {
      await InteractionController.announceSubmission(
        submissionChannelId,
        codeBlock(escapeCodeBlock(submittedMessage)),
      );
    } catch (reason: unknown) {
      Log.error("Could not send anonymous submission.", reason);
      const isTooLong: boolean = AppError.is(
        reason,
        AppErrorCode.DISCORD_EMBED_DESCRIPTION_TOO_LONG,
      );
      const isMissingChannel: boolean = AppError.is(
        reason,
        AppErrorCode.DISCORD_CHANNEL_NOT_FOUND,
      );
      await InteractionController.informError(
        message,
        this.__formatSubmissionError(isTooLong, isMissingChannel),
      );
      return;
    }
    await InteractionController.informSuccess(
      message,
      "Your message was submitted anonymously.",
    );
  }

  private __formatSubmissionError(
    isTooLong: boolean,
    isMissingChannel: boolean,
  ): string {
    if (isTooLong) {
      return "Your submission is too long to post. Please shorten it and try again.";
    }
    if (isMissingChannel) {
      return "Could not send your submission because the submission channel was not found. Contact an admin.";
    }
    return "Could not send your submission. Contact an admin.";
  }

  private async __getSubmissionChannelId(
    message: ChannelCommandMessage,
  ): Promise<string | null> {
    let channelIds: string[] = ChannelCache.getChannelIds(
      message.member.guild.id,
      AppEnvironment.config.submissionChannelName,
    );
    if (channelIds.length !== 1) {
      try {
        await ChannelCache.cacheGuild(message.member.guild);
      } catch (reason: unknown) {
        Log.error("Could not refresh guild channel cache.", reason, {
          guildId: message.member.guild.id,
        });
        return null;
      }
      channelIds = ChannelCache.getChannelIds(
        message.member.guild.id,
        AppEnvironment.config.submissionChannelName,
      );
    }
    if (channelIds.length !== 1) {
      Log.error("Could not resolve submission channel.", {
        channelIds,
        channelName: AppEnvironment.config.submissionChannelName,
        guildId: message.member.guild.id,
      });
      return null;
    }
    return channelIds[0];
  }
}
