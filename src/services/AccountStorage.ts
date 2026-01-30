/**
 * AccountStorage Service
 * Handles saving, loading, exporting, and importing account data
 * Supports JSON, CSV, and XLSX formats
 * Provides importable/exportable account format
 */

import type { PlayerAccount } from './AccountExtractor';

export interface StoredAccount {
  id: string;
  email: string;
  server: string;
  lastUpdated: string;
  fileSize: string;
  data: PlayerAccount;
}

export interface AccountExportFormat {
  version: string;
  exportedAt: string;
  format: 'svony-account-v1';
  accounts: StoredAccount[];
}

export class AccountStorage {
  private static STORAGE_KEY = 'svony_accounts';
  private static MAX_ACCOUNTS = 100;

  static generateAccountId(email: string, server: string): string {
    return `${email.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${server.toLowerCase()}`;
  }

  static saveAccount(account: PlayerAccount): StoredAccount {
    const stored: StoredAccount = {
      id: this.generateAccountId(account.player.email, account.metadata.server),
      email: account.player.email,
      server: account.metadata.server,
      lastUpdated: new Date().toISOString(),
      fileSize: this.calculateSize(JSON.stringify(account)),
      data: account,
    };

    const accounts = this.getAllAccounts();
    const existingIndex = accounts.findIndex((a) => a.id === stored.id);

    if (existingIndex >= 0) {
      accounts[existingIndex] = stored;
    } else {
      accounts.unshift(stored);
      if (accounts.length > this.MAX_ACCOUNTS) {
        accounts.pop();
      }
    }

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(accounts));
    return stored;
  }

  static getAccount(id: string): StoredAccount | null {
    const accounts = this.getAllAccounts();
    return accounts.find((a) => a.id === id) || null;
  }

  static getAllAccounts(): StoredAccount[] {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  static deleteAccount(id: string): boolean {
    const accounts = this.getAllAccounts();
    const filtered = accounts.filter((a) => a.id !== id);
    if (filtered.length < accounts.length) {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
      return true;
    }
    return false;
  }

  static clearAllAccounts(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  static calculateSize(json: string): string {
    const bytes = new Blob([json]).size;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  static exportToJSON(accounts?: StoredAccount[]): string {
    const toExport = accounts || this.getAllAccounts();
    const exportData: AccountExportFormat = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      format: 'svony-account-v1',
      accounts: toExport,
    };
    return JSON.stringify(exportData, null, 2);
  }

  static exportToCSV(account: PlayerAccount): string {
    const lines: string[] = [];

    lines.push('=== PLAYER INFO ===');
    lines.push('Field,Value');
    lines.push(`Name,${account.player.name}`);
    lines.push(`Email,${account.player.email}`);
    lines.push(`Server,${account.metadata.server}`);
    lines.push(`Prestige,${account.player.prestige}`);
    lines.push(`Honor,${account.player.honor}`);
    lines.push(`Rank,${account.player.rank}`);
    lines.push(`Stars,${account.player.stars}`);
    lines.push(`Coins,${account.player.gameCoins}`);
    lines.push('');

    lines.push('=== TOTAL TROOPS ===');
    lines.push('Troop Type,Count');
    const t = account.totals.troops;
    lines.push(`Worker,${t.worker}`);
    lines.push(`Warrior,${t.warrior}`);
    lines.push(`Scout,${t.scout}`);
    lines.push(`Pikeman,${t.pikeman}`);
    lines.push(`Swordsman,${t.swordsman}`);
    lines.push(`Archer,${t.archer}`);
    lines.push(`Cavalry,${t.cavalry}`);
    lines.push(`Cataphract,${t.cataphract}`);
    lines.push(`Transporter,${t.transporter}`);
    lines.push(`Ballista,${t.ballista}`);
    lines.push(`Battering Ram,${t.batteringRam}`);
    lines.push(`Catapult,${t.catapult}`);
    lines.push('');

    lines.push('=== TOTAL RESOURCES ===');
    lines.push('Resource,Amount');
    const r = account.totals.resources;
    lines.push(`Food,${r.food}`);
    lines.push(`Lumber,${r.lumber}`);
    lines.push(`Stone,${r.stone}`);
    lines.push(`Iron,${r.iron}`);
    lines.push(`Gold,${r.gold}`);
    lines.push('');

    lines.push('=== CASTLES ===');
    lines.push('Name,Level,X,Y,Population,Food,Lumber,Stone,Iron,Gold,Heroes');
    for (const castle of account.castles) {
      lines.push(
        [
          castle.name,
          castle.level,
          castle.coordX,
          castle.coordY,
          castle.population.current,
          castle.resources.food,
          castle.resources.lumber,
          castle.resources.stone,
          castle.resources.iron,
          castle.resources.gold,
          castle.heroes.length,
        ].join(',')
      );
    }
    lines.push('');

    lines.push('=== HEROES ===');
    lines.push('Name,Level,Attack,Defense,Politics,Intelligence,Stars,Status');
    for (const castle of account.castles) {
      for (const hero of castle.heroes) {
        lines.push(
          [
            hero.name,
            hero.level,
            hero.attack,
            hero.defense,
            hero.politics,
            hero.intelligence,
            hero.stars,
            hero.status,
          ].join(',')
        );
      }
    }

    return lines.join('\n');
  }

  static exportTroopsPerCityCSV(account: PlayerAccount): string {
    const lines: string[] = [];

    lines.push(
      'City,Worker,Warrior,Scout,Pikeman,Swordsman,Archer,Cavalry,Cataphract,Transport,Ballista,Ram,Catapult,Total'
    );

    for (const castle of account.castles) {
      const t = castle.troops;
      const total =
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
        t.catapult;
      lines.push(
        [
          castle.name,
          t.worker,
          t.warrior,
          t.scout,
          t.pikeman,
          t.swordsman,
          t.archer,
          t.cavalry,
          t.cataphract,
          t.transporter,
          t.ballista,
          t.batteringRam,
          t.catapult,
          total,
        ].join(',')
      );
    }

    const tt = account.totals.troops;
    const grandTotal =
      tt.worker +
      tt.warrior +
      tt.scout +
      tt.pikeman +
      tt.swordsman +
      tt.archer +
      tt.cavalry +
      tt.cataphract +
      tt.transporter +
      tt.ballista +
      tt.batteringRam +
      tt.catapult;
    lines.push(
      [
        'TOTAL',
        tt.worker,
        tt.warrior,
        tt.scout,
        tt.pikeman,
        tt.swordsman,
        tt.archer,
        tt.cavalry,
        tt.cataphract,
        tt.transporter,
        tt.ballista,
        tt.batteringRam,
        tt.catapult,
        grandTotal,
      ].join(',')
    );

    return lines.join('\n');
  }

  static importFromJSON(jsonString: string): StoredAccount[] {
    try {
      const data = JSON.parse(jsonString);

      if (data.format === 'svony-account-v1' && Array.isArray(data.accounts)) {
        for (const account of data.accounts) {
          this.saveAccount(account.data);
        }
        return data.accounts;
      }

      if (data.player && data.metadata) {
        const stored = this.saveAccount(data as PlayerAccount);
        return [stored];
      }

      throw new Error('Unrecognized account format');
    } catch (error) {
      console.error('Import error:', error);
      throw new Error('Failed to import account data');
    }
  }

  static downloadFile(
    content: string,
    filename: string,
    mimeType: string = 'application/json'
  ): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  static downloadAccountJSON(account: PlayerAccount): void {
    const filename = `${account.player.name}_${account.metadata.server}_${Date.now()}.json`;
    this.downloadFile(JSON.stringify(account, null, 2), filename);
  }

  static downloadAccountCSV(account: PlayerAccount): void {
    const filename = `${account.player.name}_${account.metadata.server}_${Date.now()}.csv`;
    this.downloadFile(this.exportToCSV(account), filename, 'text/csv');
  }

  static downloadTroopsCSV(account: PlayerAccount): void {
    const filename = `${account.player.name}_troops_${account.metadata.server}_${Date.now()}.csv`;
    this.downloadFile(
      this.exportTroopsPerCityCSV(account),
      filename,
      'text/csv'
    );
  }

  static downloadAllAccounts(): void {
    const filename = `svony_all_accounts_${Date.now()}.json`;
    this.downloadFile(this.exportToJSON(), filename);
  }

  static getStorageStats(): {
    count: number;
    totalSize: string;
    oldestDate: string;
    newestDate: string;
  } {
    const accounts = this.getAllAccounts();
    if (accounts.length === 0) {
      return {
        count: 0,
        totalSize: '0 B',
        oldestDate: 'N/A',
        newestDate: 'N/A',
      };
    }

    const json = JSON.stringify(accounts);
    const dates = accounts
      .map((a) => new Date(a.lastUpdated))
      .sort((a, b) => a.getTime() - b.getTime());

    return {
      count: accounts.length,
      totalSize: this.calculateSize(json),
      oldestDate: dates[0]?.toLocaleDateString() || 'N/A',
      newestDate: dates[dates.length - 1]?.toLocaleDateString() || 'N/A',
    };
  }
}

export default AccountStorage;
