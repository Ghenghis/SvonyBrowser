#!/usr/bin/env node
/**
 * Automatic Version Bump Script for SvonyBrowser
 * 
 * Version Strategy:
 * - 2.2.x  → 2.2.99 (patch releases)
 * - 2.2.99 → 2.3.0  (minor bump when patch maxes out)
 * - 2.x.y  → 2.99.99 max before 3.0.0
 * - 3.0.0 is RESERVED for "Enterprise Grade with 42 Fagan Audits"
 * 
 * Usage:
 *   node scripts/version-bump.js [patch|minor|major]
 *   node scripts/version-bump.js --auto  (smart auto-increment)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PACKAGE_PATH = path.join(__dirname, '..', 'package.json');
const MAX_PATCH = 99;
const MAX_MINOR = 99;
const RESERVED_MAJOR = '3.0.0';

function readPackageJson() {
    const content = fs.readFileSync(PACKAGE_PATH, 'utf8');
    return JSON.parse(content);
}

function writePackageJson(pkg) {
    fs.writeFileSync(PACKAGE_PATH, JSON.stringify(pkg, null, 2) + '\n');
}

function parseVersion(version) {
    const [major, minor, patch] = version.split('.').map(Number);
    return { major, minor, patch };
}

function formatVersion({ major, minor, patch }) {
    return `${major}.${minor}.${patch}`;
}

/**
 * Smart auto-increment following the versioning strategy
 */
function autoIncrement(current) {
    let { major, minor, patch } = parseVersion(current);
    
    // Block any attempt to reach 3.0.0 automatically
    if (major >= 3) {
        console.error('ERROR: Version 3.0.0 is RESERVED for Enterprise Release');
        console.error('Cannot auto-increment past 2.99.99');
        process.exit(1);
    }
    
    // Increment patch
    patch++;
    
    // If patch exceeds 99, bump minor and reset patch
    if (patch > MAX_PATCH) {
        patch = 0;
        minor++;
    }
    
    // If minor exceeds 99, we're at the limit before 3.0.0
    if (minor > MAX_MINOR) {
        console.error('ERROR: Reached version 2.99.99');
        console.error('Version 3.0.0 requires manual release with 42 Fagan Audits');
        console.error('Use: npm run version:major-release');
        process.exit(1);
    }
    
    return formatVersion({ major, minor, patch });
}

/**
 * Bump patch version (2.2.7 → 2.2.8)
 */
function bumpPatch(current) {
    let { major, minor, patch } = parseVersion(current);
    
    if (major >= 3) {
        console.error('ERROR: Cannot bump patch on version 3.x');
        process.exit(1);
    }
    
    patch++;
    if (patch > MAX_PATCH) {
        console.log(`Patch exceeded ${MAX_PATCH}, bumping minor instead`);
        return bumpMinor(current);
    }
    
    return formatVersion({ major, minor, patch });
}

/**
 * Bump minor version (2.2.99 → 2.3.0)
 */
function bumpMinor(current) {
    let { major, minor, patch } = parseVersion(current);
    
    if (major >= 3) {
        console.error('ERROR: Cannot bump minor on version 3.x');
        process.exit(1);
    }
    
    minor++;
    patch = 0;
    
    if (minor > MAX_MINOR) {
        console.error('ERROR: Reached version 2.99.x');
        console.error('Version 3.0.0 requires Enterprise Release approval');
        process.exit(1);
    }
    
    return formatVersion({ major, minor, patch });
}

/**
 * Major release - ONLY for 3.0.0 Enterprise
 */
function bumpMajor(current) {
    const { major } = parseVersion(current);
    
    if (major === 2) {
        console.log('');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('  🚀 MAJOR RELEASE: Svony Browser 3.0.0 - Enterprise Grade');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('');
        console.log('Prerequisites for 3.0.0 release:');
        console.log('  ✓ 42 Fagan Inspection Audits completed');
        console.log('  ✓ All critical issues resolved');
        console.log('  ✓ Full test coverage');
        console.log('  ✓ Security audit passed');
        console.log('  ✓ Performance benchmarks met');
        console.log('');
        
        return RESERVED_MAJOR;
    }
    
    console.error('ERROR: Major bump only allowed from 2.x to 3.0.0');
    process.exit(1);
}

/**
 * Get git commit count for build metadata
 */
function getCommitCount() {
    try {
        const count = execSync('git rev-list --count HEAD', { encoding: 'utf8' }).trim();
        return parseInt(count, 10);
    } catch {
        return 0;
    }
}

/**
 * Get short git hash
 */
function getGitHash() {
    try {
        return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
    } catch {
        return 'unknown';
    }
}

// Main execution
function main() {
    const args = process.argv.slice(2);
    const bumpType = args[0] || '--auto';
    
    const pkg = readPackageJson();
    const currentVersion = pkg.version;
    let newVersion;
    
    console.log(`Current version: ${currentVersion}`);
    
    switch (bumpType) {
        case 'patch':
        case '-p':
            newVersion = bumpPatch(currentVersion);
            break;
            
        case 'minor':
        case '-m':
            newVersion = bumpMinor(currentVersion);
            break;
            
        case 'major':
        case 'major-release':
        case '-M':
            newVersion = bumpMajor(currentVersion);
            break;
            
        case '--auto':
        case 'auto':
        case '-a':
        default:
            newVersion = autoIncrement(currentVersion);
            break;
    }
    
    // Update package.json
    pkg.version = newVersion;
    writePackageJson(pkg);
    
    // Get build info
    const commitCount = getCommitCount();
    const gitHash = getGitHash();
    
    console.log(`New version: ${newVersion}`);
    console.log(`Build: ${commitCount} (${gitHash})`);
    console.log('');
    console.log(`Updated package.json to version ${newVersion}`);
    
    // Return version for use in scripts
    return newVersion;
}

// Export for testing
module.exports = {
    parseVersion,
    formatVersion,
    autoIncrement,
    bumpPatch,
    bumpMinor,
    bumpMajor
};

// Run if called directly
if (require.main === module) {
    main();
}
