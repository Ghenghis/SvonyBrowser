/**
 * ScriptManager - Manages 500+ user AutoEvony scripts
 * Provides categorization, search, AI generation, and execution
 */

export interface EvonyScript {
  id: string;
  name: string;
  category: ScriptCategory;
  description: string;
  content: string;
  author: string;
  version: string;
  created: string;
  modified: string;
  tags: string[];
  usageCount: number;
  rating: number;
  isAIGenerated: boolean;
}

export type ScriptCategory =
  | 'troop-glitch'
  | 'food-glitch'
  | 'move-glitch'
  | 'attack'
  | 'defense'
  | 'farming'
  | 'building'
  | 'research'
  | 'hero'
  | 'alliance'
  | 'trading'
  | 'automation'
  | 'exploit'
  | 'utility'
  | 'custom';

export interface ScriptSearchParams {
  query?: string;
  category?: ScriptCategory;
  tags?: string[];
  author?: string;
  isAIGenerated?: boolean;
  minRating?: number;
  sortBy?: 'name' | 'rating' | 'usageCount' | 'created' | 'modified';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface AIScriptRequest {
  description: string;
  category: ScriptCategory;
  requirements: string[];
  referenceScripts?: string[];
  safetyLevel: 'safe' | 'override' | 'danger';
}

export class ScriptManager {
  private scripts: Map<string, EvonyScript> = new Map();
  private categories: Map<ScriptCategory, EvonyScript[]> = new Map();

  constructor() {
    this.initializeCategories();
  }

  private initializeCategories(): void {
    const cats: ScriptCategory[] = [
      'troop-glitch',
      'food-glitch',
      'move-glitch',
      'attack',
      'defense',
      'farming',
      'building',
      'research',
      'hero',
      'alliance',
      'trading',
      'automation',
      'exploit',
      'utility',
      'custom',
    ];
    cats.forEach((cat) => this.categories.set(cat, []));
  }

  generateId(): string {
    return `script_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  addScript(
    script: Omit<
      EvonyScript,
      'id' | 'created' | 'modified' | 'usageCount' | 'rating'
    >
  ): EvonyScript {
    const now = new Date().toISOString();
    const newScript: EvonyScript = {
      ...script,
      id: this.generateId(),
      created: now,
      modified: now,
      usageCount: 0,
      rating: 0,
    };

    this.scripts.set(newScript.id, newScript);
    this.categories.get(newScript.category)?.push(newScript);

    return newScript;
  }

  getScript(id: string): EvonyScript | undefined {
    return this.scripts.get(id);
  }

  updateScript(id: string, updates: Partial<EvonyScript>): EvonyScript | null {
    const script = this.scripts.get(id);
    if (!script) return null;

    const updatedScript = {
      ...script,
      ...updates,
      id: script.id,
      created: script.created,
      modified: new Date().toISOString(),
    };

    this.scripts.set(id, updatedScript);
    return updatedScript;
  }

  deleteScript(id: string): boolean {
    const script = this.scripts.get(id);
    if (!script) return false;

    this.scripts.delete(id);
    const catScripts = this.categories.get(script.category);
    if (catScripts) {
      const index = catScripts.findIndex((s) => s.id === id);
      if (index >= 0) catScripts.splice(index, 1);
    }

    return true;
  }

  search(params: ScriptSearchParams): EvonyScript[] {
    let results = Array.from(this.scripts.values());

    if (params.query) {
      const query = params.query.toLowerCase();
      results = results.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          s.description.toLowerCase().includes(query) ||
          s.content.toLowerCase().includes(query) ||
          s.tags.some((t) => t.toLowerCase().includes(query))
      );
    }

    if (params.category) {
      results = results.filter((s) => s.category === params.category);
    }

    if (params.tags && params.tags.length > 0) {
      results = results.filter((s) =>
        params.tags!.some((tag) => s.tags.includes(tag))
      );
    }

    if (params.author) {
      results = results.filter((s) =>
        s.author.toLowerCase().includes(params.author!.toLowerCase())
      );
    }

    if (params.isAIGenerated !== undefined) {
      results = results.filter((s) => s.isAIGenerated === params.isAIGenerated);
    }

    if (params.minRating !== undefined) {
      results = results.filter((s) => s.rating >= params.minRating!);
    }

    const sortBy = params.sortBy || 'name';
    const sortOrder = params.sortOrder || 'asc';
    results.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'rating':
          comparison = a.rating - b.rating;
          break;
        case 'usageCount':
          comparison = a.usageCount - b.usageCount;
          break;
        case 'created':
          comparison =
            new Date(a.created).getTime() - new Date(b.created).getTime();
          break;
        case 'modified':
          comparison =
            new Date(a.modified).getTime() - new Date(b.modified).getTime();
          break;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    if (params.offset) {
      results = results.slice(params.offset);
    }
    if (params.limit) {
      results = results.slice(0, params.limit);
    }

    return results;
  }

  getByCategory(category: ScriptCategory): EvonyScript[] {
    return this.categories.get(category) || [];
  }

  getAllCategories(): { category: ScriptCategory; count: number }[] {
    return Array.from(this.categories.entries()).map(([category, scripts]) => ({
      category,
      count: scripts.length,
    }));
  }

  incrementUsage(id: string): void {
    const script = this.scripts.get(id);
    if (script) {
      script.usageCount++;
    }
  }

  rateScript(id: string, rating: number): void {
    const script = this.scripts.get(id);
    if (script && rating >= 0 && rating <= 5) {
      script.rating = (script.rating + rating) / 2;
    }
  }

  async generateAIScript(request: AIScriptRequest): Promise<EvonyScript> {
    // Future: Use reference content for AI generation context
    // const referenceContent = request.referenceScripts?.map(...).join(...) || '';
    
    // AI generation would use prompt and reference content for future implementation
    // For now, generating based on requirements directly

    const generatedContent = this.generateRealScript(request);

    return this.addScript({
      name: `AI: ${request.description.substring(0, 50)}`,
      category: request.category,
      description: request.description,
      content: generatedContent,
      author: 'AI Generator',
      version: '1.0.0',
      tags: ['ai-generated', request.category, request.safetyLevel],
      isAIGenerated: true,
    });
  }

  private generateRealScript(request: AIScriptRequest): string {
    const safetyChecks =
      request.safetyLevel === 'safe'
        ? `// Safety checks enabled
if (currentTroops > 700000000) {
  log("WARNING: Exceeds safe limit");
  stop();
}
`
        : request.safetyLevel === 'override'
          ? `// Override mode - higher limits
if (currentTroops > 1000000000) {
  log("WARNING: Exceeds override limit");
  stop();
}
`
          : `// DANGER MODE - No limits
log("DANGER: No safety limits active");
`;

    return `// AI Generated Script
// Category: ${request.category}
// Description: ${request.description}
// Safety Level: ${request.safetyLevel}
// Generated: ${new Date().toISOString()}

${safetyChecks}
// Requirements: ${request.requirements.join(', ')}

function main() {
  log("Starting ${request.description}");
  
  // Implementation based on requirements
  ${this.generateImplementationCode(request.requirements, request.category)}
  
  log("Script complete - executed all requirements");
}

main();
`;
  }

  private generateImplementationCode(requirements: string[], _category: string): string {
    const implementations: string[] = [];
    
    for (const req of requirements) {
      const reqLower = req.toLowerCase();
      
      // Generate specific implementation based on requirement
      if (reqLower.includes('troop') && reqLower.includes('glitch')) {
        implementations.push(`  // Troop glitch implementation
  if (valleyDistance === 1) {
    executeThunderRaids(7);
    relocateTroops(currentTroops);
    log("Troop glitch executed successfully");
  }`);
      } else if (reqLower.includes('food') && reqLower.includes('glitch')) {
        implementations.push(`  // Food glitch implementation  
  if (foodAmount <= 485000000000) {
    transportToValley(foodAmount);
    executeFoodDuplication();
    log("Food glitch completed");
  }`);
      } else if (reqLower.includes('scan') || reqLower.includes('account')) {
        implementations.push(`  // Account scanning implementation
  const accounts = loadAccountList();
  for (const account of accounts) {
    scanAccountData(account);
    validateExploitReadiness(account);
  }`);
      } else if (reqLower.includes('automation')) {
        implementations.push(`  // Automation implementation
  initializeBot();
  executeAutomationSequence();
  monitorResults();`);
      } else {
        // Generic implementation
        implementations.push(`  // ${req} implementation
  executeRequirement("${req}");
  validateResult("${req}");`);
      }
    }
    
    return implementations.length > 0 ? implementations.join('\n\n') : '  // No specific requirements to implement';
  }

  exportScripts(): string {
    return JSON.stringify(Array.from(this.scripts.values()), null, 2);
  }

  importScripts(json: string): number {
    try {
      const scripts: EvonyScript[] = JSON.parse(json);
      let imported = 0;
      scripts.forEach((script) => {
        if (!this.scripts.has(script.id)) {
          this.scripts.set(script.id, script);
          this.categories.get(script.category)?.push(script);
          imported++;
        }
      });
      return imported;
    } catch {
      return 0;
    }
  }

  getStats(): {
    total: number;
    byCategory: Record<string, number>;
    aiGenerated: number;
  } {
    const byCategory: Record<string, number> = {};
    let aiGenerated = 0;

    this.scripts.forEach((script) => {
      byCategory[script.category] = (byCategory[script.category] || 0) + 1;
      if (script.isAIGenerated) aiGenerated++;
    });

    return {
      total: this.scripts.size,
      byCategory,
      aiGenerated,
    };
  }
}

export const scriptManager = new ScriptManager();
export default ScriptManager;
