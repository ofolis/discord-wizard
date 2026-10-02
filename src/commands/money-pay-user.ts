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
import { MoneyUtils } from "../money-utils";
import { MoneyState } from "../saveables";

const amountOptionName: string = "amount";
const userOptionName: string = "user";

export class MoneyPayUser implements Command {
  public readonly description: string = "Pays money to a user publicly.";

  public readonly isAvailableToAllUsers: boolean = false;

  public readonly name: string = "moneypayuser";

  public readonly options: CommandOption[] = [
    {
      description: "The user to pay.",
      isRequired: true,
      name: userOptionName,
      type: CommandOptionType.USER,
    },
    {
      description: "The money amount to pay.",
      isRequired: true,
      maxValue: Number.MAX_SAFE_INTEGER / 100,
      minValue: 0,
      name: amountOptionName,
      type: CommandOptionType.NUMBER,
    },
  ];

  public readonly registrationType: CommandRegistrationType =
    CommandRegistrationType.GUILD;

  public readonly shouldReplyPrivately: boolean = true;

  public async execute(message: ChannelCommandMessage): Promise<void> {
    const member: discordJs.GuildMember | undefined =
      await message.getGuildMemberCommandOption(userOptionName);
    const amountCents: number | null = MoneyUtils.parseAmountCents(
      message.getCommandOption(amountOptionName, CommandOptionType.NUMBER),
    );
    if (member === undefined) {
      await InteractionController.informError(
        message,
        "That user is not available on this server.",
      );
      return;
    }
    if (member.user.bot) {
      await InteractionController.informError(
        message,
        "Money can only be paid to human users.",
      );
      return;
    }
    if (amountCents === null) {
      await InteractionController.informError(
        message,
        "Money amount must be zero or greater.",
      );
      return;
    }

    const moneyState: MoneyState = DataController.loadOrCreateMoneyState(
      message.member.guild.id,
    );

    try {
      moneyState.addBalance(member.user.id, amountCents);
      DataController.saveMoneyState(moneyState);
    } catch (reason: unknown) {
      Log.error("Could not save user money payment.", reason);
      await InteractionController.informError(
        message,
        "Could not pay user money. Contact an admin.",
      );
      return;
    }

    try {
      await InteractionController.announceMoneyPayment(message.channelId, {
        amountCents,
        recipientName: Discord.formatUserMentionString(member.user),
      });
    } catch (reason: unknown) {
      Log.error("Could not announce user money payment.", reason);
      await InteractionController.informError(
        message,
        "Money was paid, but the announcement could not be posted. Contact an admin.",
      );
      return;
    }

    await InteractionController.informSuccess(
      message,
      `Paid \`${MoneyUtils.format(amountCents)}\` to **${Discord.formatGuildMemberNameString(member)}**. New balance: \`${MoneyUtils.format(moneyState.getBalance(member.user.id))}\`.`,
    );
  }
}
