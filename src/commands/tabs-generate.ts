import { InteractionController } from "../controllers";
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

const budgetOptionName: string = "budget";
const minUnitCost: number = 50;
const halflingJackpotRoll: number = 64;

type TabsUnit = {
  readonly cost: number;
  readonly faction: string;
  readonly name: string;
};

type TabsTeamMember = {
  readonly count: number;
  readonly unit: TabsUnit;
};

type TabsTeam = {
  readonly members: TabsTeamMember[];
  readonly remainingBudget: number;
};

const factionOrder: string[] = [
  "Tribal",
  "Farmer",
  "Medieval",
  "Ancient",
  "Viking",
  "Dynasty",
  "Renaissance",
  "Pirate",
  "Spooky",
  "Wild West",
  "Legacy",
  "Evil",
  "Good",
  "Secret",
];

const factionSortOrder: Record<string, number> = Object.fromEntries(
  factionOrder.map((faction, index) => [faction, index]),
);

const units: TabsUnit[] = [
  { cost: 70, faction: "Tribal", name: "Clubber" },
  { cost: 80, faction: "Tribal", name: "Protector" },
  { cost: 120, faction: "Tribal", name: "Spear Thrower" },
  { cost: 160, faction: "Tribal", name: "Stoner" },
  { cost: 300, faction: "Tribal", name: "Bone Mage" },
  { cost: 400, faction: "Tribal", name: "Chieftan" },
  { cost: 2200, faction: "Tribal", name: "Mammoth" },
  { cost: 50, faction: "Farmer", name: "Halfling" },
  { cost: 80, faction: "Farmer", name: "Farmer" },
  { cost: 140, faction: "Farmer", name: "Hay Baler" },
  { cost: 340, faction: "Farmer", name: "Potionseller" },
  { cost: 500, faction: "Farmer", name: "Harvester" },
  { cost: 1000, faction: "Farmer", name: "Wheelbarrow" },
  { cost: 1200, faction: "Farmer", name: "Scarecrow" },
  { cost: 60, faction: "Medieval", name: "Bard" },
  { cost: 100, faction: "Medieval", name: "Squire" },
  { cost: 140, faction: "Medieval", name: "Archer" },
  { cost: 180, faction: "Medieval", name: "Healer" },
  { cost: 650, faction: "Medieval", name: "Knight" },
  { cost: 1000, faction: "Medieval", name: "Catapult" },
  { cost: 1500, faction: "Medieval", name: "The King" },
  { cost: 100, faction: "Ancient", name: "Shield Bearer" },
  { cost: 120, faction: "Ancient", name: "Sarissa" },
  { cost: 180, faction: "Ancient", name: "Hoplite" },
  { cost: 300, faction: "Ancient", name: "Snake Archer" },
  { cost: 900, faction: "Ancient", name: "Ballista" },
  { cost: 1600, faction: "Ancient", name: "Minotaur" },
  { cost: 2000, faction: "Ancient", name: "Zeus" },
  { cost: 90, faction: "Viking", name: "Headbutter" },
  { cost: 160, faction: "Viking", name: "Ice Archer" },
  { cost: 220, faction: "Viking", name: "Brawler" },
  { cost: 250, faction: "Viking", name: "Berserker" },
  { cost: 500, faction: "Viking", name: "Valkyrie" },
  { cost: 1000, faction: "Viking", name: "Longship" },
  { cost: 1500, faction: "Viking", name: "Jarl" },
  { cost: 140, faction: "Dynasty", name: "Samurai" },
  { cost: 180, faction: "Dynasty", name: "Firework Archer" },
  { cost: 250, faction: "Dynasty", name: "Monk" },
  { cost: 500, faction: "Dynasty", name: "Ninja" },
  { cost: 1000, faction: "Dynasty", name: "Dragon" },
  { cost: 1500, faction: "Dynasty", name: "Hwacha" },
  { cost: 2000, faction: "Dynasty", name: "Monkey King" },
  { cost: 50, faction: "Renaissance", name: "Painter" },
  { cost: 150, faction: "Renaissance", name: "Fencer" },
  { cost: 200, faction: "Renaissance", name: "Balloon Archer" },
  { cost: 250, faction: "Renaissance", name: "Musketeer" },
  { cost: 400, faction: "Renaissance", name: "Halberd" },
  { cost: 1000, faction: "Renaissance", name: "Jouster" },
  { cost: 4000, faction: "Renaissance", name: "Da Vinci Tank" },
  { cost: 100, faction: "Pirate", name: "Flintlock" },
  { cost: 160, faction: "Pirate", name: "Blunderbuss" },
  { cost: 250, faction: "Pirate", name: "Bomb Thrower" },
  { cost: 300, faction: "Pirate", name: "Harpooner" },
  { cost: 1000, faction: "Pirate", name: "Cannon" },
  { cost: 1500, faction: "Pirate", name: "Captain" },
  { cost: 2500, faction: "Pirate", name: "Pirate Queen" },
  { cost: 80, faction: "Spooky", name: "Skeleton Warrior" },
  { cost: 180, faction: "Spooky", name: "Skeleton Archer" },
  { cost: 200, faction: "Spooky", name: "Candlehead" },
  { cost: 200, faction: "Spooky", name: "Vampire" },
  { cost: 1000, faction: "Spooky", name: "Pumpkin Catapult" },
  { cost: 1000, faction: "Spooky", name: "Swordcaster" },
  { cost: 2500, faction: "Spooky", name: "Reaper" },
  { cost: 100, faction: "Wild West", name: "Dynamite Thrower" },
  { cost: 200, faction: "Wild West", name: "Miner" },
  { cost: 400, faction: "Wild West", name: "Cactus" },
  { cost: 650, faction: "Wild West", name: "Gunslinger" },
  { cost: 740, faction: "Wild West", name: "Lasso" },
  { cost: 900, faction: "Wild West", name: "Deadeye" },
  { cost: 1200, faction: "Wild West", name: "Quick Draw" },
];

export class TabsGenerate implements Command {
  public readonly description: string = "Generates random TABS teams.";

  public readonly isAvailableToAllUsers: boolean = false;

  public readonly name: string = "tabsgenerate";

  public readonly options: CommandOption[] = [
    {
      description: "The gold budget for each team.",
      isRequired: true,
      maxValue: Number.MAX_SAFE_INTEGER,
      minValue: minUnitCost,
      name: budgetOptionName,
      type: CommandOptionType.INTEGER,
    },
  ];

  public readonly registrationType: CommandRegistrationType =
    CommandRegistrationType.GUILD;

  public readonly shouldReplyPrivately: boolean = false;

  public async execute(message: ChannelCommandMessage): Promise<void> {
    const budget: number | undefined = message.getCommandOption(
      budgetOptionName,
      CommandOptionType.INTEGER,
    );
    if (budget === undefined || budget < minUnitCost) {
      await InteractionController.informError(
        message,
        "Enter a budget of at least `50` gold.",
      );
      return;
    }
    try {
      await InteractionController.showTabsGeneration(message, {
        blueTeam: this.__generateTeam(budget),
        budget,
        redTeam: this.__generateTeam(budget),
      });
    } catch (reason: unknown) {
      Log.error("Could not show generated TABS teams.", reason);
      if (
        AppError.is(reason, AppErrorCode.DISCORD_EMBED_DESCRIPTION_TOO_LONG)
      ) {
        await InteractionController.informError(
          message,
          "Generated teams were too long to display. Please use a lower budget and try again.",
        );
        return;
      }
      await InteractionController.informError(
        message,
        "Could not generate TABS teams. Contact an admin.",
      );
    }
  }

  private __generateHalflingTeam(budget: number): TabsTeam {
    const halfling: TabsUnit = this.__getUnitByName("Halfling");
    const count: number = Math.floor(budget / halfling.cost);
    const remainingBudget: number = budget - halfling.cost * count;
    return {
      members: [{ count, unit: halfling }],
      remainingBudget,
    };
  }

  private __generateTeam(budget: number): TabsTeam {
    if (this.__randomInteger(0, 99) === halflingJackpotRoll) {
      return this.__generateHalflingTeam(budget);
    }
    let remainingBudget: number = budget;
    const members: TabsTeamMember[] = [];
    const availableUnits: TabsUnit[] = [...units];

    while (remainingBudget >= minUnitCost && availableUnits.length > 0) {
      const unitIndex: number = this.__randomInteger(
        0,
        availableUnits.length - 1,
      );
      const unit: TabsUnit = availableUnits[unitIndex];
      const unitLimit: number = Math.floor(remainingBudget / unit.cost);
      if (unitLimit > 0) {
        const count: number = this.__randomInteger(1, unitLimit);
        members.push({ count, unit });
        remainingBudget -= unit.cost * count;
      }
      availableUnits.splice(unitIndex, 1);
    }

    return {
      members: this.__sortTeam(members),
      remainingBudget,
    };
  }

  private __getFactionSortOrder(faction: string): number {
    return factionSortOrder[faction] ?? factionOrder.length;
  }

  private __getUnitByName(name: string): TabsUnit {
    const unit: TabsUnit | undefined = units.find(item => item.name === name);
    if (unit === undefined) {
      throw new Error(`Missing TABS unit: ${name}`);
    }
    return unit;
  }

  private __randomInteger(minimum: number, maximum: number): number {
    return Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;
  }

  private __sortTeam(team: TabsTeamMember[]): TabsTeamMember[] {
    return [...team].sort((a, b) => {
      const factionComparison: number =
        this.__getFactionSortOrder(a.unit.faction) -
        this.__getFactionSortOrder(b.unit.faction);
      if (factionComparison !== 0) {
        return factionComparison;
      }
      return units.indexOf(a.unit) - units.indexOf(b.unit);
    });
  }
}
