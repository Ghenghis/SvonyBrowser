/**
 * AccountViewer Component
 * Professional display of all player account data with game-like layout
 * Uses Evony artwork assets for authentic presentation
 */

import React, { useState, useEffect } from 'react';
import AccountExtractor, {
  PlayerAccount,
  Castle,
  Hero,
  TroopCount,
  ResourceCount,
  TROOP_NAMES,
  BUILDING_NAMES,
} from '../services/AccountExtractor';

interface AccountViewerProps {
  accountData?: PlayerAccount;
  onExport?: (format: 'json' | 'csv' | 'xlsx') => void;
  onSave?: (account: PlayerAccount) => void;
}

const TROOP_ICONS: Record<string, string> = {
  worker:
    '70_autoevony.gui.newarmy.NewArmyWin__embed_mxml_autoevony_gui_images_troopLogo_wo_icon_png.png',
  warrior:
    '122_autoevony.gui.newarmy.NewArmyWin__embed_mxml_autoevony_gui_images_troopLogo_w_icon_png.png',
  scout:
    '57_autoevony.gui.newarmy.NewArmyWin__embed_mxml_autoevony_gui_images_troopLogo_s_icon_png.png',
  pikeman:
    '65_autoevony.gui.newarmy.NewArmyWin__embed_mxml_autoevony_gui_images_troopLogo_p_icon_png.png',
  swordsman:
    '118_autoevony.gui.newarmy.NewArmyWin__embed_mxml_autoevony_gui_images_troopLogo_sw_icon_png.png',
  archer:
    '102_autoevony.gui.newarmy.NewArmyWin__embed_mxml_autoevony_gui_images_troopLogo_a_icon_png.png',
  cavalry:
    '54_autoevony.gui.newarmy.NewArmyWin__embed_mxml_autoevony_gui_images_troopLogo_c_icon_png.png',
  cataphract:
    '116_autoevony.gui.newarmy.NewArmyWin__embed_mxml_autoevony_gui_images_troopLogo_cata_icon_png.png',
  transporter:
    '131_autoevony.gui.newarmy.NewArmyWin__embed_mxml_autoevony_gui_images_troopLogo_t_icon_png.png',
  ballista:
    '89_autoevony.gui.newarmy.NewArmyWin__embed_mxml_autoevony_gui_images_troopLogo_b_icon_png.png',
  batteringRam:
    '40_autoevony.gui.newarmy.NewArmyWin__embed_mxml_autoevony_gui_images_troopLogo_r_icon_png.png',
  catapult:
    '74_autoevony.gui.newarmy.NewArmyWin__embed_mxml_autoevony_gui_images_troopLogo_cp_icon_png.png',
};

const RESOURCE_ICONS: Record<string, string> = {
  food: '87_autoevony.gui.newarmy.NewArmyWin__embed_mxml_autoevony_gui_images_resoLogo_f_icon_png.png',
  lumber:
    '50_autoevony.gui.newarmy.NewArmyWin__embed_mxml_autoevony_gui_images_resoLogo_w_icon_png.png',
  stone:
    '33_autoevony.gui.newarmy.NewArmyWin__embed_mxml_autoevony_gui_images_resoLogo_s_icon_png.png',
  iron: '121_autoevony.gui.newarmy.NewArmyWin__embed_mxml_autoevony_gui_images_resoLogo_i_icon_png.png',
  gold: '32_autoevony.gui.newarmy.NewArmyWin__embed_mxml_autoevony_gui_images_resoLogo_g_icon_png.png',
};

const UI_ICONS: Record<string, string> = {
  prestige:
    '106_autoevony.gui.TopInfo__embed_mxml_autoevony_gui_images_prestige_png.png',
  honor:
    '36_autoevony.gui.TopInfo__embed_mxml_autoevony_gui_images_honor_png.png',
  rank: '56_autoevony.gui.TopInfo__embed_mxml_autoevony_gui_images_rank_png.png',
  ranking:
    '59_autoevony.gui.TopInfo__embed_mxml_autoevony_gui_images_ranking_png.png',
  alliance:
    '39_autoevony.gui.TopInfo__embed_mxml_autoevony_gui_images_alliance_png.png',
  coins:
    '93_autoevony.gui.TopInfo__embed_mxml_autoevony_gui_images_gameCoins_png.png',
  population:
    '75_autoevony.gui.CityPanel__embed_mxml_autoevony_gui_images_pop_png.png',
  production:
    '114_autoevony.gui.CityPanel__embed_mxml_autoevony_gui_images_prod_png.png',
  taxes:
    '105_autoevony.gui.CityPanel__embed_mxml_autoevony_gui_images_taxes_png.png',
  loyalty:
    '38_autoevony.gui.CityPanel__embed_mxml_autoevony_gui_images_loyGrieve_png.png',
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
    color: '#eee',
    padding: '20px',
    fontFamily: "'Segoe UI', Tahoma, sans-serif",
    minHeight: '100vh',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '15px 20px',
    background: 'rgba(0,0,0,0.3)',
    borderRadius: '10px',
    marginBottom: '20px',
    borderBottom: '2px solid #e94560',
  },
  playerName: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#ffd700',
  },
  statsBar: {
    display: 'flex',
    gap: '20px',
    flexWrap: 'wrap' as const,
  },
  statItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 15px',
    background: 'rgba(233,69,96,0.15)',
    borderRadius: '5px',
    border: '1px solid rgba(233,69,96,0.3)',
  },
  statIcon: {
    width: '24px',
    height: '24px',
  },
  statValue: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#ffd700',
  },
  statLabel: {
    fontSize: '11px',
    color: '#888',
  },
  section: {
    background: 'rgba(0,0,0,0.3)',
    borderRadius: '10px',
    padding: '20px',
    marginBottom: '20px',
    border: '1px solid #333',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#e94560',
    marginBottom: '15px',
    paddingBottom: '10px',
    borderBottom: '1px solid #333',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '15px',
  },
  card: {
    background: 'rgba(0,0,0,0.3)',
    borderRadius: '8px',
    padding: '15px',
    border: '1px solid #444',
    transition: 'border-color 0.2s',
  },
  cardTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#ffd700',
    marginBottom: '10px',
  },
  troopGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '10px',
  },
  troopItem: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    padding: '8px',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '5px',
  },
  troopIcon: {
    width: '32px',
    height: '32px',
    marginBottom: '4px',
  },
  troopCount: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#fff',
  },
  troopName: {
    fontSize: '10px',
    color: '#888',
  },
  resourceRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '5px 0',
  },
  resourceIcon: {
    width: '24px',
    height: '24px',
  },
  resourceValue: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  exportBar: {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px',
  },
  exportBtn: {
    padding: '10px 20px',
    background: '#e94560',
    color: '#fff',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  tabs: {
    display: 'flex',
    gap: '5px',
    marginBottom: '15px',
  },
  tab: {
    padding: '10px 20px',
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid #333',
    borderRadius: '5px',
    cursor: 'pointer',
    color: '#ccc',
    transition: 'all 0.2s',
  },
  tabActive: {
    background: '#e94560',
    borderColor: '#e94560',
    color: '#fff',
  },
  heroCard: {
    background: 'rgba(0,0,0,0.4)',
    borderRadius: '8px',
    padding: '12px',
    border: '1px solid #444',
  },
  heroName: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#ffd700',
  },
  heroStats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '5px',
    marginTop: '8px',
  },
  heroStat: {
    fontSize: '12px',
    color: '#aaa',
  },
  totalsSection: {
    background:
      'linear-gradient(135deg, rgba(233,69,96,0.2) 0%, rgba(22,33,62,0.8) 100%)',
    border: '2px solid #e94560',
  },
  noData: {
    textAlign: 'center' as const,
    padding: '40px',
    color: '#666',
  },
};

const TroopDisplay: React.FC<{ troops: TroopCount; showIcons?: boolean }> = ({
  troops,
  showIcons = true,
}) => {
  const troopEntries = [
    { key: 'worker', name: 'Worker', count: troops.worker },
    { key: 'warrior', name: 'Warrior', count: troops.warrior },
    { key: 'scout', name: 'Scout', count: troops.scout },
    { key: 'pikeman', name: 'Pikeman', count: troops.pikeman },
    { key: 'swordsman', name: 'Swordsman', count: troops.swordsman },
    { key: 'archer', name: 'Archer', count: troops.archer },
    { key: 'cavalry', name: 'Cavalry', count: troops.cavalry },
    { key: 'cataphract', name: 'Cataphract', count: troops.cataphract },
    { key: 'transporter', name: 'Transport', count: troops.transporter },
    { key: 'ballista', name: 'Ballista', count: troops.ballista },
    { key: 'batteringRam', name: 'Ram', count: troops.batteringRam },
    { key: 'catapult', name: 'Catapult', count: troops.catapult },
  ];

  return (
    <div style={styles.troopGrid}>
      {troopEntries.map((t) => (
        <div key={t.key} style={styles.troopItem}>
          {showIcons && TROOP_ICONS[t.key] && (
            <img
              src={`themes/assets/evony/${TROOP_ICONS[t.key]}`}
              alt={t.name}
              style={styles.troopIcon}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          )}
          <span style={styles.troopCount}>{t.count.toLocaleString()}</span>
          <span style={styles.troopName}>{t.name}</span>
        </div>
      ))}
    </div>
  );
};

const ResourceDisplay: React.FC<{ resources: ResourceCount }> = ({
  resources,
}) => {
  const resourceEntries = [
    { key: 'food', name: 'Food', value: resources.food },
    { key: 'lumber', name: 'Lumber', value: resources.lumber },
    { key: 'stone', name: 'Stone', value: resources.stone },
    { key: 'iron', name: 'Iron', value: resources.iron },
    { key: 'gold', name: 'Gold', value: resources.gold },
  ];

  return (
    <div>
      {resourceEntries.map((r) => (
        <div key={r.key} style={styles.resourceRow}>
          {RESOURCE_ICONS[r.key] && (
            <img
              src={`themes/assets/evony/${RESOURCE_ICONS[r.key]}`}
              alt={r.name}
              style={styles.resourceIcon}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          )}
          <span style={{ color: '#888', width: '60px' }}>{r.name}:</span>
          <span style={styles.resourceValue}>{r.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
};

const CastleCard: React.FC<{ castle: Castle }> = ({ castle }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={styles.card}>
      <div
        style={{
          ...styles.cardTitle,
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <span>
          {castle.name} (Lv.{castle.level})
        </span>
        <span style={{ color: '#888' }}>{expanded ? '▼' : '▶'}</span>
      </div>

      <div style={{ fontSize: '12px', color: '#888', marginBottom: '10px' }}>
        Coords: ({castle.coordX}, {castle.coordY}) | Pop:{' '}
        {castle.population.current.toLocaleString()}
      </div>

      {expanded && (
        <>
          <div style={{ marginBottom: '15px' }}>
            <div
              style={{
                fontWeight: 'bold',
                color: '#e94560',
                marginBottom: '8px',
              }}
            >
              Resources
            </div>
            <ResourceDisplay resources={castle.resources} />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <div
              style={{
                fontWeight: 'bold',
                color: '#e94560',
                marginBottom: '8px',
              }}
            >
              Troops
            </div>
            <TroopDisplay troops={castle.troops} />
          </div>

          {castle.heroes.length > 0 && (
            <div>
              <div
                style={{
                  fontWeight: 'bold',
                  color: '#e94560',
                  marginBottom: '8px',
                }}
              >
                Heroes ({castle.heroes.length})
              </div>
              {castle.heroes.map((hero) => (
                <div key={hero.id} style={styles.heroCard}>
                  <div style={styles.heroName}>
                    {hero.name} {hero.stars > 0 && `★${hero.stars}`}
                  </div>
                  <div style={styles.heroStats}>
                    <span style={styles.heroStat}>Lv: {hero.level}</span>
                    <span style={styles.heroStat}>ATK: {hero.attack}</span>
                    <span style={styles.heroStat}>DEF: {hero.defense}</span>
                    <span style={styles.heroStat}>POL: {hero.politics}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

const AccountViewer: React.FC<AccountViewerProps> = ({
  accountData,
  onExport,
  onSave,
}) => {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'castles' | 'totals' | 'export'
  >('overview');
  const [account, setAccount] = useState<PlayerAccount | null>(
    accountData || null
  );

  useEffect(() => {
    if (accountData) {
      setAccount(accountData);
    }
  }, [accountData]);

  if (!account) {
    return (
      <div style={styles.container}>
        <div style={styles.noData}>
          <h2>No Account Data</h2>
          <p>Load an account or extract data from a logged-in session.</p>
        </div>
      </div>
    );
  }

  const getTotalTroops = (): number => {
    const t = account.totals.troops;
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
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <div style={styles.playerName}>{account.player.name}</div>
          <div style={{ color: '#888', fontSize: '12px' }}>
            {account.player.email} | Server: {account.metadata.server}
          </div>
        </div>
        <div style={styles.statsBar}>
          <div style={styles.statItem}>
            <img
              src={`themes/assets/evony/${UI_ICONS.prestige}`}
              alt="Prestige"
              style={styles.statIcon}
            />
            <div>
              <div style={styles.statValue}>
                {account.player.prestige.toLocaleString()}
              </div>
              <div style={styles.statLabel}>Prestige</div>
            </div>
          </div>
          <div style={styles.statItem}>
            <img
              src={`themes/assets/evony/${UI_ICONS.honor}`}
              alt="Honor"
              style={styles.statIcon}
            />
            <div>
              <div style={styles.statValue}>
                {account.player.honor.toLocaleString()}
              </div>
              <div style={styles.statLabel}>Honor</div>
            </div>
          </div>
          <div style={styles.statItem}>
            <img
              src={`themes/assets/evony/${UI_ICONS.rank}`}
              alt="Rank"
              style={styles.statIcon}
            />
            <div>
              <div style={styles.statValue}>#{account.player.rank}</div>
              <div style={styles.statLabel}>Rank</div>
            </div>
          </div>
          <div style={styles.statItem}>
            <img
              src={`themes/assets/evony/${UI_ICONS.coins}`}
              alt="Coins"
              style={styles.statIcon}
            />
            <div>
              <div style={styles.statValue}>
                {account.player.gameCoins.toLocaleString()}
              </div>
              <div style={styles.statLabel}>Coins</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        {['overview', 'castles', 'totals', 'export'].map((tab) => (
          <div
            key={tab}
            style={{
              ...styles.tab,
              ...(activeTab === tab ? styles.tabActive : {}),
            }}
            onClick={() => setActiveTab(tab as any)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </div>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Account Summary</div>
            <div style={styles.grid}>
              <div style={styles.card}>
                <div style={styles.cardTitle}>Player Info</div>
                <div style={{ lineHeight: 1.8 }}>
                  <div>
                    Name: <strong>{account.player.name}</strong>
                  </div>
                  <div>Title: {account.player.title || 'None'}</div>
                  <div>Stars: {'★'.repeat(account.player.stars) || '0'}</div>
                  <div>
                    Population: {account.player.population.toLocaleString()}
                  </div>
                </div>
              </div>

              {account.alliance && (
                <div style={styles.card}>
                  <div style={styles.cardTitle}>Alliance</div>
                  <div style={{ lineHeight: 1.8 }}>
                    <div>
                      Name: <strong>{account.alliance.name}</strong>
                    </div>
                    <div>Leader: {account.alliance.leaderName}</div>
                    <div>Members: {account.alliance.members}</div>
                    <div>Rank: #{account.alliance.rank}</div>
                  </div>
                </div>
              )}

              <div style={styles.card}>
                <div style={styles.cardTitle}>Statistics</div>
                <div style={{ lineHeight: 1.8 }}>
                  <div>
                    Castles: <strong>{account.totals.castleCount}</strong>
                  </div>
                  <div>
                    Heroes: <strong>{account.totals.heroCount}</strong>
                  </div>
                  <div>
                    Total Troops:{' '}
                    <strong>{getTotalTroops().toLocaleString()}</strong>
                  </div>
                  <div>
                    Items: <strong>{account.items.length}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={styles.section}>
            <div style={styles.sectionTitle}>Total Resources</div>
            <ResourceDisplay resources={account.totals.resources} />
          </div>
        </>
      )}

      {/* Castles Tab */}
      {activeTab === 'castles' && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>
            Castles ({account.castles.length})
          </div>
          <div style={styles.grid}>
            {account.castles.map((castle) => (
              <CastleCard key={castle.id} castle={castle} />
            ))}
          </div>
        </div>
      )}

      {/* Totals Tab */}
      {activeTab === 'totals' && (
        <div style={{ ...styles.section, ...styles.totalsSection }}>
          <div style={styles.sectionTitle}>Account Totals</div>

          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ color: '#e94560', marginBottom: '10px' }}>
              Total Troops Across All Cities
            </h3>
            <TroopDisplay troops={account.totals.troops} />
            <div
              style={{
                marginTop: '15px',
                fontSize: '18px',
                fontWeight: 'bold',
                color: '#ffd700',
              }}
            >
              Grand Total: {getTotalTroops().toLocaleString()} troops
            </div>
          </div>

          <div>
            <h3 style={{ color: '#e94560', marginBottom: '10px' }}>
              Total Resources
            </h3>
            <ResourceDisplay resources={account.totals.resources} />
          </div>
        </div>
      )}

      {/* Export Tab */}
      {activeTab === 'export' && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Export Account Data</div>

          <div style={{ marginBottom: '20px' }}>
            <p style={{ color: '#888', marginBottom: '15px' }}>
              Export complete account data (estimated{' '}
              {new AccountExtractor().getEstimatedFileSize?.() || '2-12 MB'})
            </p>

            <div style={styles.exportBar}>
              <button
                style={styles.exportBtn}
                onClick={() => onExport?.('json')}
              >
                Export JSON
              </button>
              <button
                style={{ ...styles.exportBtn, background: '#4CAF50' }}
                onClick={() => onExport?.('csv')}
              >
                Export CSV
              </button>
              <button
                style={{ ...styles.exportBtn, background: '#2196F3' }}
                onClick={() => onExport?.('xlsx')}
              >
                Export XLSX
              </button>
            </div>
          </div>

          <div>
            <h4 style={{ color: '#e94560', marginBottom: '10px' }}>
              Data Includes:
            </h4>
            <ul style={{ color: '#aaa', lineHeight: 2 }}>
              <li>Player info (prestige, honor, rank, stars, coins)</li>
              <li>
                All {account.castles.length} castles with buildings, troops,
                resources
              </li>
              <li>
                {account.totals.heroCount} heroes with stats, items, buffs
              </li>
              <li>{account.items.length} inventory items</li>
              <li>Alliance information</li>
              <li>Quest progress</li>
              <li>Account-wide totals and summaries</li>
            </ul>
          </div>

          <div style={{ marginTop: '20px' }}>
            <button
              style={{
                ...styles.exportBtn,
                background: '#9C27B0',
                width: '100%',
              }}
              onClick={() => onSave?.(account)}
            >
              Save Account to Local Storage
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          textAlign: 'center',
          padding: '20px',
          color: '#666',
          fontSize: '12px',
        }}
      >
        Extracted: {account.metadata.extractedAt} | Version:{' '}
        {account.metadata.version}
      </div>
    </div>
  );
};

export default AccountViewer;
