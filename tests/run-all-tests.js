#!/usr/bin/env node
/**
 * Svony Browser - Run All Tests
 * Executes complete test suite for v2.1.0
 */

const { runAllTests } = require('./test-runner');
const { createServiceTests } = require('./unit/services.test');
const { createIPCTests } = require('./unit/ipc-handlers.test');
const { createIntegrationTests } = require('./integration/service-integration.test');

async function main() {
    console.log('\n🧪 Starting Svony Browser Test Suite v2.1.0\n');
    
    // Collect all test suites
    const allSuites = [];
    
    // Add service tests
    console.log('Loading service tests...');
    const serviceTests = createServiceTests();
    allSuites.push(...serviceTests);
    
    // Add IPC handler tests
    console.log('Loading IPC handler tests...');
    const ipcTests = createIPCTests();
    allSuites.push(...ipcTests);
    
    // Add integration tests
    console.log('Loading integration tests...');
    const integrationTests = createIntegrationTests();
    allSuites.push(...integrationTests);
    
    console.log(`\nTotal test suites: ${allSuites.length}`);
    
    // Run all tests
    const results = await runAllTests(allSuites);
    
    // Exit with appropriate code
    process.exit(results.failed > 0 ? 1 : 0);
}

main().catch(err => {
    console.error('Test runner failed:', err);
    process.exit(1);
});
