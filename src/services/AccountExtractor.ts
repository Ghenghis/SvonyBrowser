/**
 * Evony Account Data Extractor
 * Comprehensive extraction of all player data including:
 * - Player info, prestige, honor, stars
 * - All castles with buildings, troops, resources
 * - Heroes with stats, items, buffs
 * - Items inventory
 * - Alliance info
 * - Army compositions per city
 * - Total troop counts across account
 *
 * Exports: JSON (2-12MB per account), CSV, XLSX formats
 */

export interface TroopCount {
  worker: number;
  warrior: number;
  scout: number;
  pikeman: number;
  swordsman: number;
  archer: number;
  cavalry: number;
  cataphract: number;
  transporter: number;
  ballista: number;
  batteringRam: number;
  catapult: number;
}

export interface ResourceCount {
  food: number;
  lumber: number;
  stone: number;
  iron: number;
  gold: number;
}

export interface Building {
  positionId: number;
  typeId: number;
  level: number;
  status: number;
  name: string;
  startTime: number;
  endTime: number;
}

export interface Hero {
  id: number;
  name: string;
  level: number;
  experience: number;
  attack: number;
  defense: number;
  politics: number;
  intelligence: number;
  loyalty: number;
  status: string;
  items: HeroItem[];
  buffs: HeroBuff[];
  stars: number;
}

export interface HeroItem {
  id: number;
  name: string;
  type: string;
  level: number;
  slot: string;
}

export interface HeroBuff {
  id: number;
  name: string;
  duration: number;
  effect: string;
}

export interface Castle {
  id: number;
  name: string;
  level: number;
  status: number;
  fieldId: number;
  coordX: number;
  coordY: number;
  buildings: Building[];
  troops: TroopCount;
  resources: ResourceCount;
  heroes: Hero[];
  fortifications: FortificationCount;
  population: {
    current: number;
    max: number;
    idle: number;
  };
  production: {
    food: number;
    lumber: number;
    stone: number;
    iron: number;
    gold: number;
  };
  taxRate: number;
  loyalty: number;
  grievance: number;
}

export interface FortificationCount {
  trap: number;
  abatis: number;
  archerTower: number;
  rollingLog: number;
  trebuchet: number;
}

export interface AllianceInfo {
  id: number;
  name: string;
  rank: number;
  members: number;
  prestige: number;
  honor: number;
  description: string;
  leaderName: string;
}

export interface PlayerAccount {
  metadata: {
    extractedAt: string;
    version: string;
    server: string;
    fileSize?: string;
  };
  player: {
    id: number;
    name: string;
    email: string;
    prestige: number;
    honor: number;
    rank: number;
    title: string;
    stars: number;
    gameCoins: number;
    cents: number;
    population: number;
    flag: string;
  };
  alliance: AllianceInfo | null;
  castles: Castle[];
  items: InventoryItem[];
  quests: Quest[];
  buffs: AccountBuff[];
  totals: {
    troops: TroopCount;
    resources: ResourceCount;
    castleCount: number;
    heroCount: number;
    totalPrestige: number;
    totalPopulation: number;
  };
}

export interface InventoryItem {
  id: number;
  itemId: number;
  name: string;
  count: number;
  category: string;
  description: string;
}

export interface Quest {
  id: number;
  name: string;
  type: string;
  status: string;
  progress: number;
  target: number;
  rewards: string[];
}

export interface AccountBuff {
  id: number;
  name: string;
  type: string;
  remaining: number;
  effect: string;
}

export const TROOP_NAMES: Record<number, string> = {
  1: 'Worker',
  2: 'Warrior',
  3: 'Scout',
  4: 'Pikeman',
  5: 'Swordsman',
  6: 'Archer',
  7: 'Cavalry',
  8: 'Cataphract',
  9: 'Transporter',
  10: 'Ballista',
  11: 'Battering Ram',
  12: 'Catapult',
};

export const BUILDING_NAMES: Record<number, string> = {
  1: 'Cottage',
  2: 'Barracks',
  3: 'Inn',
  4: 'Feasting Hall',
  5: 'Embassy',
  6: 'Castle',
  7: 'Warehouse',
  8: 'Stable',
  9: 'Relief Station',
  10: 'Academy',
  11: 'Forge',
  12: 'Workshop',
  13: 'Wall',
  14: 'Tower',
  15: 'Rally Spot',
  16: 'Beacon Tower',
  17: 'Farm',
  18: 'Sawmill',
  19: 'Quarry',
  20: 'Ironmine',
};

export class AccountExtractor {
  private account: PlayerAccount | null = null;

  createEmptyTroopCount(): TroopCount {
    return {
      worker: 0,
      warrior: 0,
      scout: 0,
      pikeman: 0,
      swordsman: 0,
      archer: 0,
      cavalry: 0,
      cataphract: 0,
      transporter: 0,
      ballista: 0,
      batteringRam: 0,
      catapult: 0,
    };
  }

  createEmptyResourceCount(): ResourceCount {
    return {
      food: 0,
      lumber: 0,
      stone: 0,
      iron: 0,
      gold: 0,
    };
  }

  parseTroopsFromResponse(troopData: any[]): TroopCount {
    const troops = this.createEmptyTroopCount();

    if (!troopData || !Array.isArray(troopData)) return troops;

    for (const t of troopData) {
      const typeId = t.typeId || t.type;
      const count = t.count || t.amount || 0;

      switch (typeId) {
        case 1:
          troops.worker = count;
          break;
        case 2:
          troops.warrior = count;
          break;
        case 3:
          troops.scout = count;
          break;
        case 4:
          troops.pikeman = count;
          break;
        case 5:
          troops.swordsman = count;
          break;
        case 6:
          troops.archer = count;
          break;
        case 7:
          troops.cavalry = count;
          break;
        case 8:
          troops.cataphract = count;
          break;
        case 9:
          troops.transporter = count;
          break;
        case 10:
          troops.ballista = count;
          break;
        case 11:
          troops.batteringRam = count;
          break;
        case 12:
          troops.catapult = count;
          break;
      }
    }

    return troops;
  }

  parseResourcesFromResponse(resData: any): ResourceCount {
    return {
      food: resData?.food || resData?.f || 0,
      lumber: resData?.lumber || resData?.w || resData?.wood || 0,
      stone: resData?.stone || resData?.s || 0,
      iron: resData?.iron || resData?.i || 0,
      gold: resData?.gold || resData?.g || 0,
    };
  }

  parseBuildingsFromResponse(buildingData: any[]): Building[] {
    if (!buildingData || !Array.isArray(buildingData)) return [];

    return buildingData.map((b) => ({
      positionId: b.positionId || 0,
      typeId: b.typeId || 0,
      level: b.level || 0,
      status: b.status || 0,
      name: BUILDING_NAMES[b.typeId] || 'Unknown',
      startTime: b.startTime || 0,
      endTime: b.endTime || 0,
    }));
  }

  parseHeroFromResponse(heroData: any): Hero {
    return {
      id: heroData.id || 0,
      name: heroData.name || 'Unknown',
      level: heroData.level || 1,
      experience: heroData.experience || heroData.exp || 0,
      attack: heroData.power || heroData.attack || 0,
      defense: heroData.management || heroData.defense || 0,
      politics: heroData.stratagem || heroData.politics || 0,
      intelligence: heroData.intelligence || heroData.intel || 0,
      loyalty: heroData.loyalty || 100,
      status: heroData.status === 0 ? 'Idle' : 'Assigned',
      items: this.parseHeroItems(heroData.items || heroData.equipment),
      buffs: this.parseHeroBuffs(heroData.buffs),
      stars: heroData.stars || heroData.star || 0,
    };
  }

  parseHeroItems(items: any[]): HeroItem[] {
    if (!items || !Array.isArray(items)) return [];

    return items.map((item) => ({
      id: item.id || 0,
      name: item.name || 'Unknown Item',
      type: item.type || 'equipment',
      level: item.level || 1,
      slot: item.slot || 'unknown',
    }));
  }

  parseHeroBuffs(buffs: any[]): HeroBuff[] {
    if (!buffs || !Array.isArray(buffs)) return [];

    return buffs.map((buff) => ({
      id: buff.id || 0,
      name: buff.name || 'Unknown Buff',
      duration: buff.duration || buff.remaining || 0,
      effect: buff.effect || buff.description || '',
    }));
  }

  parseCastleFromResponse(castleData: any): Castle {
    const troops = this.parseTroopsFromResponse(
      castleData.trpiods || castleData.troops
    );
    const resources = this.parseResourcesFromResponse(
      castleData.resource || castleData.resources
    );
    const buildings = this.parseBuildingsFromResponse(castleData.buildings);
    const heroes = (castleData.heroes || []).map((h: any) =>
      this.parseHeroFromResponse(h)
    );

    return {
      id: castleData.id || 0,
      name: castleData.name || 'Unknown City',
      level: this.getCastleLevel(buildings),
      status: castleData.status || 0,
      fieldId: castleData.fieldId || 0,
      coordX: castleData.x || 0,
      coordY: castleData.y || 0,
      buildings,
      troops,
      resources,
      heroes,
      fortifications: this.parseFortifications(castleData.fortification),
      population: {
        current: castleData.population?.current || 0,
        max: castleData.population?.max || 0,
        idle: castleData.population?.idle || 0,
      },
      production: {
        food: castleData.production?.food || 0,
        lumber: castleData.production?.lumber || 0,
        stone: castleData.production?.stone || 0,
        iron: castleData.production?.iron || 0,
        gold: castleData.production?.gold || 0,
      },
      taxRate: castleData.taxRate || 20,
      loyalty: castleData.loyalty || 100,
      grievance: castleData.grievance || 0,
    };
  }

  getCastleLevel(buildings: Building[]): number {
    const castle = buildings.find((b) => b.typeId === 6);
    return castle?.level || 1;
  }

  parseFortifications(fortData: any): FortificationCount {
    return {
      trap: fortData?.trap || 0,
      abatis: fortData?.abatis || 0,
      archerTower: fortData?.archerTower || fortData?.tower || 0,
      rollingLog: fortData?.rollingLog || fortData?.log || 0,
      trebuchet: fortData?.trebuchet || fortData?.rock || 0,
    };
  }

  calculateTotals(castles: Castle[]): PlayerAccount['totals'] {
    const totalTroops = this.createEmptyTroopCount();
    const totalResources = this.createEmptyResourceCount();
    let heroCount = 0;
    let totalPopulation = 0;

    for (const castle of castles) {
      // Sum troops
      totalTroops.worker += castle.troops.worker;
      totalTroops.warrior += castle.troops.warrior;
      totalTroops.scout += castle.troops.scout;
      totalTroops.pikeman += castle.troops.pikeman;
      totalTroops.swordsman += castle.troops.swordsman;
      totalTroops.archer += castle.troops.archer;
      totalTroops.cavalry += castle.troops.cavalry;
      totalTroops.cataphract += castle.troops.cataphract;
      totalTroops.transporter += castle.troops.transporter;
      totalTroops.ballista += castle.troops.ballista;
      totalTroops.batteringRam += castle.troops.batteringRam;
      totalTroops.catapult += castle.troops.catapult;

      // Sum resources
      totalResources.food += castle.resources.food;
      totalResources.lumber += castle.resources.lumber;
      totalResources.stone += castle.resources.stone;
      totalResources.iron += castle.resources.iron;
      totalResources.gold += castle.resources.gold;

      heroCount += castle.heroes.length;
      totalPopulation += castle.population.current;
    }

    return {
      troops: totalTroops,
      resources: totalResources,
      castleCount: castles.length,
      heroCount,
      totalPrestige: 0, // Set from player data
      totalPopulation,
    };
  }

  extractFromLoginResponse(
    loginResponse: any,
    email: string,
    server: string
  ): PlayerAccount {
    const player = loginResponse.player || loginResponse;
    const castlesData = player.castles || [];

    const castles = castlesData.map((c: any) =>
      this.parseCastleFromResponse(c)
    );
    const totals = this.calculateTotals(castles);
    totals.totalPrestige = player.prestige || 0;

    this.account = {
      metadata: {
        extractedAt: new Date().toISOString(),
        version: '1.0.0',
        server,
      },
      player: {
        id: player.id || player.playerId || 0,
        name: player.playerName || player.name || 'Unknown',
        email,
        prestige: player.prestige || 0,
        honor: player.honor || 0,
        rank: player.rank || 0,
        title: player.title || '',
        stars: player.stars || 0,
        gameCoins: player.gameCoins || player.coins || 0,
        cents: player.cents || 0,
        population: totals.totalPopulation,
        flag: player.flag || '',
      },
      alliance: this.parseAlliance(player.alliance),
      castles,
      items: this.parseInventory(player.items || player.inventory),
      quests: this.parseQuests(player.quests),
      buffs: this.parseAccountBuffs(player.buffs),
      totals,
    };

    return this.account;
  }

  parseAlliance(allianceData: any): AllianceInfo | null {
    if (!allianceData || !allianceData.id) return null;

    return {
      id: allianceData.id,
      name: allianceData.name || '',
      rank: allianceData.rank || 0,
      members: allianceData.memberCount || allianceData.members || 0,
      prestige: allianceData.prestige || 0,
      honor: allianceData.honor || 0,
      description: allianceData.description || allianceData.intro || '',
      leaderName: allianceData.leader || allianceData.leaderName || '',
    };
  }

  parseInventory(items: any[]): InventoryItem[] {
    if (!items || !Array.isArray(items)) return [];

    return items.map((item) => ({
      id: item.id || 0,
      itemId: item.itemId || item.typeId || 0,
      name: item.name || 'Unknown Item',
      count: item.count || item.amount || 1,
      category: item.category || item.type || 'misc',
      description: item.description || '',
    }));
  }

  parseQuests(quests: any[]): Quest[] {
    if (!quests || !Array.isArray(quests)) return [];

    return quests.map((q) => ({
      id: q.id || 0,
      name: q.name || q.title || 'Unknown Quest',
      type: q.type || 'daily',
      status: q.status === 1 ? 'completed' : 'in_progress',
      progress: q.progress || 0,
      target: q.target || q.goal || 1,
      rewards: q.rewards || [],
    }));
  }

  parseAccountBuffs(buffs: any[]): AccountBuff[] {
    if (!buffs || !Array.isArray(buffs)) return [];

    return buffs.map((b) => ({
      id: b.id || 0,
      name: b.name || 'Unknown Buff',
      type: b.type || 'temporary',
      remaining: b.remaining || b.duration || 0,
      effect: b.effect || b.description || '',
    }));
  }

  exportToJSON(): string {
    if (!this.account) throw new Error('No account data to export');
    return JSON.stringify(this.account, null, 2);
  }

  exportToCompactJSON(): string {
    if (!this.account) throw new Error('No account data to export');
    return JSON.stringify(this.account);
  }

  getEstimatedFileSize(): string {
    const json = this.exportToJSON();
    const bytes = new Blob([json]).size;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  getAccount(): PlayerAccount | null {
    return this.account;
  }

  getTotalTroopCount(): number {
    if (!this.account) return 0;
    const t = this.account.totals.troops;
    return (
      t.worker +
      t.warrior +
      t.scout +
      t.pikeman +
      t.swordsman +
      t.archer +
      t.cavalry +
      t.cataphract +
      t.transporter +
      t.ballista +
      t.batteringRam +
      t.catapult
    );
  }

  formatTroopsForDisplay(troops: TroopCount): string[] {
    return [
      `Workers: ${troops.worker.toLocaleString()}`,
      `Warriors: ${troops.warrior.toLocaleString()}`,
      `Scouts: ${troops.scout.toLocaleString()}`,
      `Pikemen: ${troops.pikeman.toLocaleString()}`,
      `Swordsmen: ${troops.swordsman.toLocaleString()}`,
      `Archers: ${troops.archer.toLocaleString()}`,
      `Cavalry: ${troops.cavalry.toLocaleString()}`,
      `Cataphracts: ${troops.cataphract.toLocaleString()}`,
      `Transporters: ${troops.transporter.toLocaleString()}`,
      `Ballistas: ${troops.ballista.toLocaleString()}`,
      `Battering Rams: ${troops.batteringRam.toLocaleString()}`,
      `Catapults: ${troops.catapult.toLocaleString()}`,
    ];
  }

  formatResourcesForDisplay(resources: ResourceCount): string[] {
    return [
      `Food: ${resources.food.toLocaleString()}`,
      `Lumber: ${resources.lumber.toLocaleString()}`,
      `Stone: ${resources.stone.toLocaleString()}`,
      `Iron: ${resources.iron.toLocaleString()}`,
      `Gold: ${resources.gold.toLocaleString()}`,
    ];
  }
}

export default AccountExtractor;
