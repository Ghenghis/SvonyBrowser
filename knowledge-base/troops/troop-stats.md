# Evony Troop Stats Guide

## Overview

Troops are the backbone of your military power in Evony. Understanding troop types, their stats, and optimal usage is crucial for success in both PvE and PvP combat.

## Troop Tiers

### Tier 1 (Basic)

| Troop | Attack | Defense | HP | Speed | Load | Training Time |
|-------|--------|---------|-----|-------|------|---------------|
| Worker | 5 | 5 | 20 | 100 | 20 | 15s |
| Warrior | 50 | 50 | 200 | 180 | 10 | 30s |
| Scout | 20 | 20 | 50 | 3000 | 5 | 20s |

### Tier 2 (Intermediate)

| Troop | Attack | Defense | HP | Speed | Load | Training Time |
|-------|--------|---------|-----|-------|------|---------------|
| Pikeman | 150 | 150 | 300 | 300 | 15 | 60s |
| Swordsman | 100 | 250 | 400 | 275 | 20 | 90s |
| Archer | 120 | 50 | 250 | 250 | 10 | 45s |

### Tier 3 (Advanced)

| Troop | Attack | Defense | HP | Speed | Load | Training Time |
|-------|--------|---------|-----|-------|------|---------------|
| Cavalry | 250 | 180 | 500 | 1000 | 30 | 120s |
| Cataphract | 350 | 350 | 800 | 750 | 35 | 180s |
| Phalanx | 200 | 400 | 600 | 250 | 25 | 150s |

### Tier 4 (Siege)

| Troop | Attack | Defense | HP | Speed | Load | Training Time |
|-------|--------|---------|-----|-------|------|---------------|
| Ballista | 450 | 160 | 320 | 100 | 45 | 240s |
| Ram | 600 | 200 | 500 | 120 | 50 | 300s |
| Catapult | 800 | 160 | 480 | 80 | 60 | 360s |

## Troop Categories

### Ground Troops

Ground troops form the core of most armies:

- **Warriors/Swordsmen**: High defense, good for tanking
- **Pikemen/Phalanx**: Balanced stats, anti-cavalry
- **Workers**: Resource gathering specialists

### Mounted Troops

Cavalry units excel at speed and attack:

- **Scout**: Reconnaissance and fast attacks
- **Cavalry**: Fast strike force
- **Cataphract**: Heavy cavalry, balanced stats

### Ranged Troops

Ranged units deal damage from distance:

- **Archer**: Standard ranged unit
- **Crossbowman**: Higher attack, slower
- **Longbowman**: Extended range

### Siege Troops

Siege weapons for attacking fortifications:

- **Ballista**: Anti-personnel siege
- **Ram**: Gate destruction
- **Catapult**: Wall destruction

## Combat Mechanics

### Attack Priority

Combat follows this targeting priority:

1. Siege weapons target walls/gates
2. Ranged troops attack from distance
3. Cavalry charges first
4. Ground troops engage in melee

### Counter System

| Troop Type | Strong Against | Weak Against |
|------------|----------------|--------------|
| Ground | Siege, Ranged | Mounted |
| Mounted | Ground, Ranged | Pikes |
| Ranged | Ground, Siege | Mounted |
| Siege | Walls, Buildings | All troops |

### Damage Formula

```
Base Damage = (Attack * Quantity) * (1 + Attack Buffs)
Actual Damage = Base Damage * (1 - Defense Reduction)
Defense Reduction = Enemy Defense / (Enemy Defense + 1000)
```

## Training Costs

### Resource Requirements

| Troop | Food | Lumber | Stone | Iron |
|-------|------|--------|-------|------|
| Worker | 1 | 0 | 0 | 0 |
| Warrior | 10 | 0 | 0 | 0 |
| Scout | 50 | 20 | 0 | 0 |
| Pikeman | 100 | 0 | 0 | 50 |
| Swordsman | 150 | 0 | 0 | 100 |
| Archer | 50 | 150 | 0 | 0 |
| Cavalry | 250 | 0 | 0 | 150 |
| Cataphract | 350 | 0 | 0 | 350 |
| Ballista | 500 | 500 | 0 | 0 |
| Ram | 600 | 600 | 200 | 0 |
| Catapult | 800 | 400 | 400 | 0 |

## Army Composition

### Attack Compositions

**Cavalry Rush**
- 80% Cavalry/Cataphract
- 15% Archers
- 5% Siege

**Balanced Attack**
- 40% Ground (Swordsmen/Phalanx)
- 30% Mounted (Cavalry)
- 20% Ranged (Archers)
- 10% Siege

**Siege Focus**
- 50% Siege weapons
- 30% Ground (protection)
- 20% Ranged (support)

### Defense Compositions

**Wall Defense**
- 50% Ranged (Archers)
- 30% Ground (Phalanx)
- 20% Mounted (counter-attack)

**Field Defense**
- 40% Ground
- 40% Ranged
- 20% Mounted

## Buffs and Debuffs

### Common Buffs

| Source | Attack | Defense | HP | Speed |
|--------|--------|---------|-----|-------|
| Hero Skills | +5-50% | +5-50% | +5-30% | +5-30% |
| Research | +10-100% | +10-100% | +10-50% | +10-50% |
| Equipment | +10-75% | +10-75% | +10-50% | +10-50% |
| Alliance | +5-20% | +5-20% | +5-20% | +5-20% |
| Items | +10-50% | +10-50% | +10-30% | +10-100% |

### Buff Stacking

- Percentage buffs are additive within category
- Different categories multiply together
- Example: 50% hero + 50% research = 100% total buff

## Healing and Losses

### Wounded vs Dead

- Troops can be wounded (healable) or killed
- Hospital capacity determines wounded limit
- Excess casualties become dead (lost permanently)

### Healing Costs

| Tier | Resource Cost | Time |
|------|---------------|------|
| T1 | 10% of training | 20% of training time |
| T2 | 15% of training | 25% of training time |
| T3 | 20% of training | 30% of training time |
| T4 | 25% of training | 35% of training time |

## March Mechanics

### March Speed

- Determined by slowest troop in march
- Affected by hero leadership
- Terrain modifiers apply

### March Capacity

- Limited by rally spot level
- Hero leadership adds capacity
- Alliance technology increases limits
