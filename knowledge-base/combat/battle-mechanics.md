# Evony Battle Mechanics Guide

## Overview

Combat in Evony follows a deterministic system based on troop stats, hero abilities, and various buffs. Understanding these mechanics is crucial for optimizing your military strategy.

## Combat Phases

### Phase 1: Approach

1. Armies move toward each other
2. Ranged units begin attacking at maximum range
3. Cavalry charges ahead of ground troops

### Phase 2: Engagement

1. Melee combat begins
2. All troops in range attack simultaneously
3. Damage is calculated per round

### Phase 3: Resolution

1. Combat continues until one side is eliminated
2. Surviving troops return home
3. Wounded troops go to hospital (if capacity available)

## Damage Calculation

### Base Damage Formula

```
Base Attack = Troop Attack * Quantity * (1 + Attack Buffs)
Defense Reduction = Enemy Defense / (Enemy Defense + 1000)
Actual Damage = Base Attack * (1 - Defense Reduction)
Troops Killed = Actual Damage / Troop HP
```

### Example Calculation

**Attacker**: 10,000 Cavalry (Attack: 250)
- Base Attack: 250 * 10,000 = 2,500,000
- With 50% buff: 2,500,000 * 1.5 = 3,750,000

**Defender**: 10,000 Phalanx (Defense: 400, HP: 600)
- Defense Reduction: 400 / (400 + 1000) = 28.6%
- Actual Damage: 3,750,000 * 0.714 = 2,677,500
- Troops Killed: 2,677,500 / 600 = 4,462 Phalanx

## Troop Counters

### Counter System

| Attacker | Strong vs | Weak vs | Neutral |
|----------|-----------|---------|---------|
| Ground | Siege, Ranged | Mounted | Ground |
| Mounted | Ground, Ranged | Pikes | Mounted |
| Ranged | Ground, Siege | Mounted | Ranged |
| Siege | Walls, Buildings | All troops | - |

### Counter Bonuses

- Strong against: +30% damage dealt
- Weak against: -30% damage dealt
- Neutral: No modifier

## Hero Impact

### Hero Stats in Combat

| Stat | Effect |
|------|--------|
| Attack | +1% troop attack per 10 points |
| Defense | +1% troop defense per 10 points |
| Leadership | +1% troop HP per 10 points |
| Intelligence | +1% trap damage per 10 points |

### Hero Skills

**Active Skills** trigger during combat:
- Damage skills deal direct damage
- Buff skills enhance your troops
- Debuff skills weaken enemies

**Passive Skills** always apply:
- Percentage bonuses to stats
- Special abilities (heal, revive, etc.)

## Buff Categories

### Additive Buffs

These buffs add together within their category:

```
Total Attack Buff = Hero Skill + Research + Equipment + Alliance + Items
Example: 20% + 30% + 25% + 10% + 15% = 100% total
```

### Multiplicative Categories

Different categories multiply together:

```
Final Multiplier = (1 + Attack Buffs) * (1 + Specialty Bonus) * (1 + Terrain Bonus)
Example: 1.5 * 1.2 * 1.1 = 1.98 (98% total increase)
```

## Terrain Effects

### Field Battle

- No terrain modifiers
- Pure stat comparison

### City Attack

- Defender gets wall defense bonus
- Attacker needs siege weapons
- Traps deal damage before combat

### Valley/Resource Tile

- Occupier gets +10% defense
- Attacker gets +10% attack (momentum)

## Wall Defense

### Wall Mechanics

| Wall Level | Defense Bonus | Trap Capacity |
|------------|---------------|---------------|
| 1-10 | +5% per level | 100 per level |
| 11-20 | +3% per level | 200 per level |
| 21-30 | +2% per level | 300 per level |
| 31-35 | +1% per level | 400 per level |

### Trap Types

| Trap | Damage | Target | Durability |
|------|--------|--------|------------|
| Abatis | 100 | Ground | 50 |
| Archer Tower | 150 | All | 100 |
| Rolling Log | 200 | Ground | 75 |
| Defensive Trebuchet | 300 | All | 150 |

## Rally Mechanics

### Rally Basics

- Host provides rally capacity
- Members contribute troops
- Combined army attacks target

### Rally Capacity

| Rally Spot Level | Base Capacity | With Research |
|------------------|---------------|---------------|
| 1 | 100,000 | 150,000 |
| 10 | 500,000 | 750,000 |
| 20 | 2,000,000 | 3,000,000 |
| 25 | 5,000,000 | 7,500,000 |

### Rally Bonuses

- Rally host's hero leads the attack
- All participants share in rewards
- Larger rallies get bonus damage

## Reinforcement Mechanics

### Sending Reinforcements

- Troops stationed in ally's city
- Use ally's wall defense
- Return when recalled or city falls

### Reinforcement Limits

| Embassy Level | Capacity |
|---------------|----------|
| 1 | 10,000 |
| 10 | 100,000 |
| 20 | 500,000 |
| 25 | 1,000,000 |

## Combat Reports

### Report Information

- Troops sent vs troops lost
- Damage dealt vs damage received
- Resources plundered
- Experience gained

### Analyzing Reports

1. Check loss ratios
2. Compare buff effectiveness
3. Identify counter opportunities
4. Optimize future compositions

## Advanced Tactics

### Meat Shield Strategy

1. Send weak troops first (T1)
2. Enemy wastes attacks on fodder
3. Main force attacks with full strength

### Wave Attacks

1. First wave tests defenses
2. Analyze report
3. Adjust composition for second wave
4. Final wave for victory

### Fake Rallies

1. Start rally with minimal troops
2. Enemy prepares defense
3. Cancel rally
4. Attack when defenses relax

## PvP vs PvE

### PvE (Monsters/Bosses)

- Fixed enemy stats
- Predictable patterns
- Focus on damage output
- Healing between attacks

### PvP (Players)

- Variable enemy compositions
- Scouting essential
- Counter-building important
- Timing matters

## Optimization Tips

### Maximizing Damage

1. Stack attack buffs
2. Use hero with attack specialty
3. Choose troops strong against enemy
4. Time attacks with buff items

### Minimizing Losses

1. Stack defense buffs
2. Use meat shields
3. Reinforce with allies
4. Keep hospital capacity high

### Resource Efficiency

1. Train higher tier troops
2. Heal instead of retrain
3. Use appropriate troop counts
4. Avoid unnecessary battles
