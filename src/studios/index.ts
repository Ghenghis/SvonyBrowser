/**
 * Studios Index - Central hub for all SvonyBrowser Studios
 * Provides unified access to all studio engines and configurations
 */

export { GlitchEngine, glitchEngine } from './glitch-studio/GlitchEngine';
export { ScriptManager, scriptManager } from './script-studio/ScriptManager';
export { FarmingEngine, farmingEngine } from './farming-studio/FarmingEngine';
export {
  AutomationEngine,
  automationEngine,
} from './automation-studio/AutomationEngine';
export { AgentSwarm, agentSwarm } from './swarm-studio/AgentSwarm';
export {
  ExploitDiscovery,
  exploitDiscovery,
} from './exploit-studio/ExploitDiscovery';

export interface StudioInfo {
  id: string;
  name: string;
  icon: string;
  description: string;
  path: string;
  color: string;
  features: string[];
}

export const STUDIOS: StudioInfo[] = [
  {
    id: 'account-studio',
    name: 'Account Studio',
    icon: '👤',
    description: 'Account extraction, viewing, management, SOL files',
    path: 'src/studios/account-studio/index.html',
    color: '#4CAF50',
    features: [
      'Account Extraction',
      'Multi-Account',
      'SOL Parser',
      'Export/Import',
    ],
  },
  {
    id: 'glitch-studio',
    name: 'Glitch Studio',
    icon: '⚡',
    description: 'Food glitch, troop glitch, move glitch with safety limits',
    path: 'src/studios/glitch-studio/index.html',
    color: '#e94560',
    features: ['Troop Glitch', 'Food Glitch', 'Move Glitch', 'Safety Modes'],
  },
  {
    id: 'script-studio',
    name: 'Script Studio',
    icon: '📜',
    description: 'Manage 500+ AutoEvony scripts, AI generation',
    path: 'src/studios/script-studio/index.html',
    color: '#2196F3',
    features: ['Script Database', 'AI Generation', 'Categories', 'Execution'],
  },
  {
    id: 'farming-studio',
    name: 'Farming Studio',
    icon: '🎯',
    description: 'Amulet farming, thunder raid accumulation, item management',
    path: 'src/studios/farming-studio/index.html',
    color: '#ff9800',
    features: ['Amulet Farming', 'Thunder Raids', 'Valley Setup', 'Spinning'],
  },
  {
    id: 'automation-studio',
    name: 'Automation Studio',
    icon: '🤖',
    description: 'Vision, OCR, Playwright actions, multi-account',
    path: 'src/studios/automation-studio/index.html',
    color: '#9C27B0',
    features: ['Vision/OCR', 'Playwright', 'Screenshots', 'Orchestration'],
  },
  {
    id: 'exploit-studio',
    name: 'Exploit Studio',
    icon: '🔓',
    description: 'Real-time exploit discovery, protocol analysis',
    path: 'src/studios/exploit-studio/index.html',
    color: '#f44336',
    features: [
      'Network Monitor',
      'Pattern Detection',
      'Decryption',
      'RAG Integration',
    ],
  },
  {
    id: 'swarm-studio',
    name: 'Swarm Studio',
    icon: '🐝',
    description: 'Agent swarm coordination, distributed tasks',
    path: 'src/studios/swarm-studio/index.html',
    color: '#00BCD4',
    features: [
      'Agent Swarms',
      'Task Queue',
      'Exploit Discovery',
      'Coordination',
    ],
  },
  {
    id: 'protocol-studio',
    name: 'Protocol Studio',
    icon: '📡',
    description: 'Network analysis, packet capture, decryption',
    path: 'src/studios/protocol-studio/index.html',
    color: '#607D8B',
    features: [
      'Packet Capture',
      'Decryption',
      'Protocol Docs',
      'Key Extraction',
    ],
  },
];

export const GLITCH_LIMITS = {
  safe: {
    maxTroopsPerType: 700_000_000,
    maxTotalTroops: 700_000_000_000,
    maxFoodPerCity: 999_000_000_000,
    maxGoldPerAccount: 2_100_000_000,
    requiredThunderRaids: 5,
  },
  override: {
    maxTroopsPerType: 1_000_000_000,
    maxTotalTroops: 700_000_000_000,
    maxFoodPerCity: 999_000_000_000,
    maxGoldPerAccount: 2_100_000_000,
    requiredThunderRaids: 5,
  },
  danger: {
    maxTroopsPerType: Infinity,
    maxTotalTroops: Infinity,
    maxFoodPerCity: Infinity,
    maxGoldPerAccount: 2_100_000_000,
    requiredThunderRaids: 3,
  },
};

export const FARMING_TARGETS = {
  amulets: {
    stage1: 5000,
    stage2: 10000,
    stage3: 100000,
  },
  thunderRaids: {
    minimum: 250,
    optimal: 500,
  },
  attack: {
    catapultCount: 33000,
    archerCount: 20000000,
  },
};

export function getStudioById(id: string): StudioInfo | undefined {
  return STUDIOS.find((s) => s.id === id);
}

export function getStudiosByFeature(feature: string): StudioInfo[] {
  return STUDIOS.filter((s) =>
    s.features.some((f) => f.toLowerCase().includes(feature.toLowerCase()))
  );
}

export default {
  STUDIOS,
  GLITCH_LIMITS,
  FARMING_TARGETS,
  getStudioById,
  getStudiosByFeature,
};
