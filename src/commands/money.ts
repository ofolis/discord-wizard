import { DataController, InteractionController } from "../controllers";
import {
  ChannelCommandMessage,
  Command,
  CommandOption,
  Discord,
  Log,
} from "../core";
import { MoneyState } from "../saveables";

export class Money implements Command {
  public readonly description: string = "Shows your money and server ranking.";

  public readonly isGlobal: boolean = false;

  public readonly isGuild: boolean = true;

  public readonly isPrivate: boolean = true;

  public readonly name: string = "money";

  public readonly options: CommandOption[] = [];

  public async execute(message: ChannelCommandMessage): Promise<void> {
    const moneyState: MoneyState = DataController.loadOrCreateMoneyState(
      message.member.guild.id,
    );

    let members: Awaited<ReturnType<typeof Discord.getHumanGuildMembers>>;
    try {
      members = await Discord.getHumanGuildMembers(message.member.guild.id);
    } catch (reason: unknown) {
      Log.error("Could not load server members for money ranking.", reason);
      await InteractionController.informError(
        message,
        "Could not load server users. Contact an admin.",
      );
      return;
    }

    await InteractionController.showMoney(message, {
      members,
      moneyState,
      userId: message.user.id,
    });
  }
}
