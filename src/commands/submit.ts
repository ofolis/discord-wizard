import { codeBlock, escapeCodeBlock } from "discord.js";
import { ANONYMOUS_SUBMISSION_CHANNEL_NAME } from "../constants";
import { ChannelCache } from "../controllers";
import {
  ChannelCommandMessage,
  Command,
  CommandOption,
  CommandOptionType,
  Discord,
  Log,
} from "../core";

const messageOptionName: string = "message";
const submissionMessageMaxLength: number = 1900;

export class Submit implements Command {
  public readonly description: string = "Makes an anonymous submission.";

  public readonly isGlobal: boolean = false;

  public readonly isGuild: boolean = true;

  public readonly isPrivate: boolean = true;

  public readonly name: string = "submit";

  public readonly options: CommandOption[] = [
    {
      description: "The message to submit anonymously.",
      isRequired: true,
      maxLength: submissionMessageMaxLength,
      minLength: 1,
      name: messageOptionName,
      type: CommandOptionType.STRING,
    },
  ];

  public async execute(message: ChannelCommandMessage): Promise<void> {
    const submittedMessage: string | undefined = message.getCommandOption(
      messageOptionName,
      CommandOptionType.STRING,
    );
    if (submittedMessage === undefined) {
      Log.throw("Cannot submit anonymous message. Message option is missing.");
    }
    const submissionChannelId: string = ChannelCache.getChannelId(
      message.member.guild.id,
      ANONYMOUS_SUBMISSION_CHANNEL_NAME,
    );
    await Discord.sendChannelMessage(submissionChannelId, {
      content: `New Submission:\n${codeBlock(escapeCodeBlock(submittedMessage))}`,
    });
    await message.update({
      content: "Your message was submitted anonymously.",
    });
  }
}
