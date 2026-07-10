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

export class MoneyGive implements Command {
  public readonly description: string = "Gives your money to another user.";

  public readonly isAvailableToAllUsers: boolean = true;

  public readonly name: string = "moneygive";

  public readonly options: CommandOption[] = [
    {
      description: "The user to receive the money.",
      isRequired: true,
      name: userOptionName,
      type: CommandOptionType.USER,
    },
    {
      description: "The money amount to give.",
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
    const recipient: discordJs.GuildMember | undefined =
      await message.getGuildMemberCommandOption(userOptionName);
    const amountCents: number | null = MoneyUtils.parseAmountCents(
      message.getCommandOption(amountOptionName, CommandOptionType.NUMBER),
    );
    if (recipient === undefined) {
      await InteractionController.informError(
        message,
        "That user is not available on this server.",
      );
      return;
    }
    if (recipient.user.bot) {
      await InteractionController.informError(
        message,
        "Money can only be given to human users.",
      );
      return;
    }
    if (recipient.user.id === message.user.id) {
      await InteractionController.informError(
        message,
        "You cannot give money to yourself.",
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
    const senderBalanceCents: number = moneyState.getBalance(message.user.id);
    if (amountCents > senderBalanceCents) {
      await InteractionController.informError(
        message,
        `You only have \`${MoneyUtils.format(senderBalanceCents)}\`.`,
      );
      return;
    }

    try {
      moneyState.addBalance(message.user.id, -amountCents);
      moneyState.addBalance(recipient.user.id, amountCents);
      DataController.saveMoneyState(moneyState);
    } catch (reason: unknown) {
      Log.error("Could not save money gift.", reason);
      await InteractionController.informError(
        message,
        "Could not give money. Contact an admin.",
      );
      return;
    }

    try {
      await InteractionController.announceMoneyGift(message.channelId, {
        amountCents,
        recipientName: Discord.formatUserMentionString(recipient.user),
        senderName: Discord.formatGuildMemberNameString(message.member),
      });
    } catch (reason: unknown) {
      Log.error("Could not announce money gift.", reason);
      await InteractionController.informError(
        message,
        "Money was given, but the announcement could not be posted. Contact an admin.",
      );
      return;
    }

    await InteractionController.informSuccess(
      message,
      `Gave \`${MoneyUtils.format(amountCents)}\` to **${Discord.formatGuildMemberNameString(recipient)}**. Your balance: \`${MoneyUtils.format(moneyState.getBalance(message.user.id))}\`.`,
    );
  }
}
