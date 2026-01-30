/**
 * EvonyAssets Service
 * Centralized management of all Evony game artwork assets
 * Provides consistent asset paths for UI components throughout SvonyBrowser
 */

const ASSET_BASE = 'themes/assets/evony';

export const TroopAssets = {
  worker: `${ASSET_BASE}/troops/70_autoevony.gui.newarmy.NewArmyWin__embed_mxml_autoevony_gui_images_troopLogo_wo_icon_png.png`,
  warrior: `${ASSET_BASE}/troops/122_autoevony.gui.newarmy.NewArmyWin__embed_mxml_autoevony_gui_images_troopLogo_w_icon_png.png`,
  scout: `${ASSET_BASE}/troops/57_autoevony.gui.newarmy.NewArmyWin__embed_mxml_autoevony_gui_images_troopLogo_s_icon_png.png`,
  pikeman: `${ASSET_BASE}/troops/65_autoevony.gui.newarmy.NewArmyWin__embed_mxml_autoevony_gui_images_troopLogo_p_icon_png.png`,
  swordsman: `${ASSET_BASE}/troops/118_autoevony.gui.newarmy.NewArmyWin__embed_mxml_autoevony_gui_images_troopLogo_sw_icon_png.png`,
  archer: `${ASSET_BASE}/troops/102_autoevony.gui.newarmy.NewArmyWin__embed_mxml_autoevony_gui_images_troopLogo_a_icon_png.png`,
  cavalry: `${ASSET_BASE}/troops/54_autoevony.gui.newarmy.NewArmyWin__embed_mxml_autoevony_gui_images_troopLogo_c_icon_png.png`,
  cataphract: `${ASSET_BASE}/troops/116_autoevony.gui.newarmy.NewArmyWin__embed_mxml_autoevony_gui_images_troopLogo_cata_icon_png.png`,
  transporter: `${ASSET_BASE}/troops/131_autoevony.gui.newarmy.NewArmyWin__embed_mxml_autoevony_gui_images_troopLogo_t_icon_png.png`,
  ballista: `${ASSET_BASE}/troops/89_autoevony.gui.newarmy.NewArmyWin__embed_mxml_autoevony_gui_images_troopLogo_b_icon_png.png`,
  batteringRam: `${ASSET_BASE}/troops/40_autoevony.gui.newarmy.NewArmyWin__embed_mxml_autoevony_gui_images_troopLogo_r_icon_png.png`,
  catapult: `${ASSET_BASE}/troops/74_autoevony.gui.newarmy.NewArmyWin__embed_mxml_autoevony_gui_images_troopLogo_cp_icon_png.png`,
};

export const ResourceAssets = {
  food: `${ASSET_BASE}/resources/87_autoevony.gui.newarmy.NewArmyWin__embed_mxml_autoevony_gui_images_resoLogo_f_icon_png.png`,
  lumber: `${ASSET_BASE}/resources/50_autoevony.gui.newarmy.NewArmyWin__embed_mxml_autoevony_gui_images_resoLogo_w_icon_png.png`,
  stone: `${ASSET_BASE}/resources/33_autoevony.gui.newarmy.NewArmyWin__embed_mxml_autoevony_gui_images_resoLogo_s_icon_png.png`,
  iron: `${ASSET_BASE}/resources/121_autoevony.gui.newarmy.NewArmyWin__embed_mxml_autoevony_gui_images_resoLogo_i_icon_png.png`,
  gold: `${ASSET_BASE}/resources/32_autoevony.gui.newarmy.NewArmyWin__embed_mxml_autoevony_gui_images_resoLogo_g_icon_png.png`,
};

export const UIAssets = {
  prestige: `${ASSET_BASE}/ui/106_autoevony.gui.TopInfo__embed_mxml_autoevony_gui_images_prestige_png.png`,
  honor: `${ASSET_BASE}/ui/36_autoevony.gui.TopInfo__embed_mxml_autoevony_gui_images_honor_png.png`,
  rank: `${ASSET_BASE}/ui/56_autoevony.gui.TopInfo__embed_mxml_autoevony_gui_images_rank_png.png`,
  ranking: `${ASSET_BASE}/ui/59_autoevony.gui.TopInfo__embed_mxml_autoevony_gui_images_ranking_png.png`,
  alliance: `${ASSET_BASE}/ui/39_autoevony.gui.TopInfo__embed_mxml_autoevony_gui_images_alliance_png.png`,
  coins: `${ASSET_BASE}/ui/93_autoevony.gui.TopInfo__embed_mxml_autoevony_gui_images_gameCoins_png.png`,
  population: `${ASSET_BASE}/ui/75_autoevony.gui.CityPanel__embed_mxml_autoevony_gui_images_pop_png.png`,
  production: `${ASSET_BASE}/ui/114_autoevony.gui.CityPanel__embed_mxml_autoevony_gui_images_prod_png.png`,
  taxes: `${ASSET_BASE}/ui/105_autoevony.gui.CityPanel__embed_mxml_autoevony_gui_images_taxes_png.png`,
  loyalty: `${ASSET_BASE}/ui/38_autoevony.gui.CityPanel__embed_mxml_autoevony_gui_images_loyGrieve_png.png`,
  gift: `${ASSET_BASE}/ui/gift_png.png`,
  title: `${ASSET_BASE}/ui/title_png.png`,
  quest: `${ASSET_BASE}/ui/Age2Quest_png.png`,
};

export const AllianceAssets = {
  level1: `${ASSET_BASE}/ui/AllianceLv1.png`,
  level2: `${ASSET_BASE}/ui/AllianceLv2.png`,
  level3: `${ASSET_BASE}/ui/AllianceLv3.png`,
  level4: `${ASSET_BASE}/ui/AllianceLv4.png`,
  level5: `${ASSET_BASE}/ui/AllianceLv5.png`,
};

export const ControlAssets = {
  pause: `${ASSET_BASE}/ui/PauseIcon.png`,
  resume: `${ASSET_BASE}/ui/ResumeIcon.png`,
  refresh: `${ASSET_BASE}/ui/RefreshIcon.png`,
  help: `${ASSET_BASE}/ui/helpIcon_png.png`,
};

export const SoundAssets = {
  attackEnded: 'sounds/Attack_Ended_Sound.mp3',
  attackSeveral: 'sounds/Attack_Several_Sound.mp3',
  attack: 'sounds/Attack_Sound.mp3',
  attempted: 'sounds/Attempted_Sound.mp3',
  scouted: 'sounds/Scouted_Sound.mp3',
};

export type TroopType = keyof typeof TroopAssets;
export type ResourceType = keyof typeof ResourceAssets;
export type UIAssetType = keyof typeof UIAssets;

export function getTroopIcon(troopType: TroopType | number): string {
  if (typeof troopType === 'number') {
    const troopMap: Record<number, TroopType> = {
      1: 'worker',
      2: 'warrior',
      3: 'scout',
      4: 'pikeman',
      5: 'swordsman',
      6: 'archer',
      7: 'cavalry',
      8: 'cataphract',
      9: 'transporter',
      10: 'ballista',
      11: 'batteringRam',
      12: 'catapult',
    };
    troopType = troopMap[troopType] || 'warrior';
  }
  return TroopAssets[troopType] || TroopAssets.warrior;
}

export function getResourceIcon(resourceType: ResourceType): string {
  return ResourceAssets[resourceType] || ResourceAssets.gold;
}

export function getUIIcon(uiType: UIAssetType): string {
  return UIAssets[uiType] || '';
}

export function getAllianceIcon(level: number): string {
  if (level <= 1) return AllianceAssets.level1;
  if (level <= 2) return AllianceAssets.level2;
  if (level <= 3) return AllianceAssets.level3;
  if (level <= 4) return AllianceAssets.level4;
  return AllianceAssets.level5;
}

export const EvonyTheme = {
  colors: {
    primary: '#e94560',
    secondary: '#16213e',
    accent: '#ffd700',
    background: '#1a1a2e',
    surface: 'rgba(0,0,0,0.3)',
    text: '#eeeeee',
    textMuted: '#888888',
    border: '#333333',
    success: '#4CAF50',
    warning: '#ff9800',
    error: '#f44336',
  },

  gradients: {
    main: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
    header: 'linear-gradient(90deg, #16213e 0%, #1a1a2e 50%, #16213e 100%)',
    card: 'linear-gradient(180deg, rgba(233,69,96,0.1) 0%, rgba(0,0,0,0.3) 100%)',
    button: 'linear-gradient(180deg, #e94560 0%, #c73e54 100%)',
  },

  shadows: {
    card: '0 4px 6px rgba(0,0,0,0.3)',
    elevated: '0 8px 16px rgba(0,0,0,0.4)',
    glow: '0 0 10px rgba(233,69,96,0.5)',
  },

  fonts: {
    primary: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    heading: "'Trajan Pro', 'Times New Roman', serif",
    mono: "'Consolas', 'Monaco', monospace",
  },

  borderRadius: {
    small: '4px',
    medium: '8px',
    large: '12px',
    round: '50%',
  },

  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
  },
};

export function createEvonyStyles(): string {
  return `
    :root {
      --evony-primary: ${EvonyTheme.colors.primary};
      --evony-secondary: ${EvonyTheme.colors.secondary};
      --evony-accent: ${EvonyTheme.colors.accent};
      --evony-background: ${EvonyTheme.colors.background};
      --evony-surface: ${EvonyTheme.colors.surface};
      --evony-text: ${EvonyTheme.colors.text};
      --evony-text-muted: ${EvonyTheme.colors.textMuted};
      --evony-border: ${EvonyTheme.colors.border};
      --evony-success: ${EvonyTheme.colors.success};
      --evony-warning: ${EvonyTheme.colors.warning};
      --evony-error: ${EvonyTheme.colors.error};
      --evony-gradient-main: ${EvonyTheme.gradients.main};
      --evony-font-primary: ${EvonyTheme.fonts.primary};
    }

    .evony-container {
      background: var(--evony-gradient-main);
      color: var(--evony-text);
      font-family: var(--evony-font-primary);
    }

    .evony-card {
      background: var(--evony-surface);
      border: 1px solid var(--evony-border);
      border-radius: ${EvonyTheme.borderRadius.medium};
      padding: ${EvonyTheme.spacing.md};
    }

    .evony-header {
      background: ${EvonyTheme.gradients.header};
      border-bottom: 2px solid var(--evony-primary);
      padding: ${EvonyTheme.spacing.md};
    }

    .evony-title {
      color: var(--evony-accent);
      font-weight: bold;
    }

    .evony-button {
      background: ${EvonyTheme.gradients.button};
      color: white;
      border: none;
      border-radius: ${EvonyTheme.borderRadius.small};
      padding: ${EvonyTheme.spacing.sm} ${EvonyTheme.spacing.md};
      cursor: pointer;
      font-weight: bold;
      transition: transform 0.1s, box-shadow 0.1s;
    }

    .evony-button:hover {
      transform: translateY(-1px);
      box-shadow: ${EvonyTheme.shadows.glow};
    }

    .evony-button:active {
      transform: translateY(0);
    }

    .evony-input {
      background: rgba(0,0,0,0.4);
      border: 1px solid var(--evony-border);
      border-radius: ${EvonyTheme.borderRadius.small};
      color: var(--evony-text);
      padding: ${EvonyTheme.spacing.sm};
    }

    .evony-input:focus {
      border-color: var(--evony-primary);
      outline: none;
    }

    .evony-stat {
      display: flex;
      align-items: center;
      gap: ${EvonyTheme.spacing.sm};
    }

    .evony-stat-icon {
      width: 24px;
      height: 24px;
    }

    .evony-stat-value {
      color: var(--evony-accent);
      font-weight: bold;
    }

    .evony-stat-label {
      color: var(--evony-text-muted);
      font-size: 0.85em;
    }

    .evony-troop-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
      gap: ${EvonyTheme.spacing.sm};
    }

    .evony-troop-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: ${EvonyTheme.spacing.sm};
      background: rgba(255,255,255,0.05);
      border-radius: ${EvonyTheme.borderRadius.small};
    }

    .evony-troop-icon {
      width: 32px;
      height: 32px;
    }

    .evony-resource-row {
      display: flex;
      align-items: center;
      gap: ${EvonyTheme.spacing.sm};
      padding: ${EvonyTheme.spacing.xs} 0;
    }

    .evony-tabs {
      display: flex;
      gap: ${EvonyTheme.spacing.xs};
      margin-bottom: ${EvonyTheme.spacing.md};
    }

    .evony-tab {
      padding: ${EvonyTheme.spacing.sm} ${EvonyTheme.spacing.md};
      background: var(--evony-surface);
      border: 1px solid var(--evony-border);
      border-radius: ${EvonyTheme.borderRadius.small};
      cursor: pointer;
      color: var(--evony-text-muted);
      transition: all 0.2s;
    }

    .evony-tab:hover {
      border-color: var(--evony-primary);
    }

    .evony-tab.active {
      background: var(--evony-primary);
      border-color: var(--evony-primary);
      color: white;
    }

    .evony-section {
      background: var(--evony-surface);
      border-radius: ${EvonyTheme.borderRadius.medium};
      border: 1px solid var(--evony-border);
      padding: ${EvonyTheme.spacing.md};
      margin-bottom: ${EvonyTheme.spacing.md};
    }

    .evony-section-title {
      color: var(--evony-primary);
      font-weight: bold;
      font-size: 1.1em;
      margin-bottom: ${EvonyTheme.spacing.md};
      padding-bottom: ${EvonyTheme.spacing.sm};
      border-bottom: 1px solid var(--evony-border);
    }

    .evony-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: ${EvonyTheme.spacing.md};
    }
  `;
}

export function injectEvonyStyles(): void {
  if (typeof document !== 'undefined') {
    const existingStyle = document.getElementById('evony-theme-styles');
    if (existingStyle) return;

    const style = document.createElement('style');
    style.id = 'evony-theme-styles';
    style.textContent = createEvonyStyles();
    document.head.appendChild(style);
  }
}

export default {
  TroopAssets,
  ResourceAssets,
  UIAssets,
  AllianceAssets,
  ControlAssets,
  SoundAssets,
  EvonyTheme,
  getTroopIcon,
  getResourceIcon,
  getUIIcon,
  getAllianceIcon,
  createEvonyStyles,
  injectEvonyStyles,
};
