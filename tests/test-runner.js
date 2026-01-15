/**
 * Svony Browser Test Runner
 * Comprehensive testing for all services, IPC handlers, and integrations
 * v2.1.0
 */

const path = require('path');
const fs = require('fs');

// Test result tracking
const results = {
    passed: 0,
    failed: 0,
    skipped: 0,
    tests: [],
    startTime: null,
    endTime: null
};

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    dim: '\x1b[2m'
};

/**
 * Test assertion helpers
 */
const assert = {
    ok(value, message) {
        if (!value) {
            throw new Error(message || `Expected truthy value, got ${value}`);
        }
    },
    
    equal(actual, expected, message) {
        if (actual !== expected) {
            throw new Error(message || `Expected ${expected}, got ${actual}`);
        }
    },
    
    deepEqual(actual, expected, message) {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            throw new Error(message || `Deep equality failed`);
        }
    },
    
    throws(fn, message) {
        try {
            fn();
            throw new Error(message || 'Expected function to throw');
        } catch (e) {
            if (e.message === (message || 'Expected function to throw')) {
                throw e;
            }
        }
    },
    
    async rejects(promise, message) {
        try {
            await promise;
            throw new Error(message || 'Expected promise to reject');
        } catch (e) {
            if (e.message === (message || 'Expected promise to reject')) {
                throw e;
            }
        }
    },
    
    isFunction(value, message) {
        if (typeof value !== 'function') {
            throw new Error(message || `Expected function, got ${typeof value}`);
        }
    },
    
    isObject(value, message) {
        if (typeof value !== 'object' || value === null) {
            throw new Error(message || `Expected object, got ${typeof value}`);
        }
    },
    
    hasProperty(obj, prop, message) {
        if (!(prop in obj)) {
            throw new Error(message || `Expected object to have property ${prop}`);
        }
    },
    
    hasMethod(obj, method, message) {
        if (typeof obj[method] !== 'function') {
            throw new Error(message || `Expected object to have method ${method}`);
        }
    }
};

/**
 * Test suite class
 */
class TestSuite {
    constructor(name) {
        this.name = name;
        this.tests = [];
        this.beforeAll = null;
        this.afterAll = null;
        this.beforeEach = null;
        this.afterEach = null;
    }
    
    test(name, fn) {
        this.tests.push({ name, fn, skip: false });
        return this;
    }
    
    skip(name, fn) {
        this.tests.push({ name, fn, skip: true });
        return this;
    }
    
    before(fn) {
        this.beforeAll = fn;
        return this;
    }
    
    after(fn) {
        this.afterAll = fn;
        return this;
    }
    
    beforeEachTest(fn) {
        this.beforeEach = fn;
        return this;
    }
    
    afterEachTest(fn) {
        this.afterEach = fn;
        return this;
    }
    
    async run() {
        console.log(`\n${colors.cyan}▶ ${this.name}${colors.reset}`);
        
        const suiteResults = {
            name: this.name,
            passed: 0,
            failed: 0,
            skipped: 0,
            tests: []
        };
        
        try {
            if (this.beforeAll) await this.beforeAll();
        } catch (e) {
            console.log(`  ${colors.red}✗ beforeAll failed: ${e.message}${colors.reset}`);
            return suiteResults;
        }
        
        for (const test of this.tests) {
            if (test.skip) {
                console.log(`  ${colors.yellow}○ ${test.name} (skipped)${colors.reset}`);
                suiteResults.skipped++;
                results.skipped++;
                suiteResults.tests.push({ name: test.name, status: 'skipped' });
                continue;
            }
            
            try {
                if (this.beforeEach) await this.beforeEach();
                
                const startTime = Date.now();
                await test.fn(assert);
                const duration = Date.now() - startTime;
                
                if (this.afterEach) await this.afterEach();
                
                console.log(`  ${colors.green}✓ ${test.name}${colors.dim} (${duration}ms)${colors.reset}`);
                suiteResults.passed++;
                results.passed++;
                suiteResults.tests.push({ name: test.name, status: 'passed', duration });
                
            } catch (e) {
                console.log(`  ${colors.red}✗ ${test.name}${colors.reset}`);
                console.log(`    ${colors.dim}${e.message}${colors.reset}`);
                suiteResults.failed++;
                results.failed++;
                suiteResults.tests.push({ name: test.name, status: 'failed', error: e.message });
            }
        }
        
        try {
            if (this.afterAll) await this.afterAll();
        } catch (e) {
            console.log(`  ${colors.red}✗ afterAll failed: ${e.message}${colors.reset}`);
        }
        
        results.tests.push(suiteResults);
        return suiteResults;
    }
}

/**
 * Create a new test suite
 */
function describe(name, setupFn) {
    const suite = new TestSuite(name);
    setupFn(suite);
    return suite;
}

/**
 * Run all test suites
 */
async function runAllTests(suites) {
    results.startTime = new Date();
    
    console.log(`\n${colors.cyan}═══════════════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.cyan}  Svony Browser Test Suite v2.1.0${colors.reset}`);
    console.log(`${colors.cyan}═══════════════════════════════════════════════════════════════${colors.reset}`);
    
    for (const suite of suites) {
        await suite.run();
    }
    
    results.endTime = new Date();
    const duration = (results.endTime - results.startTime) / 1000;
    
    console.log(`\n${colors.cyan}═══════════════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.cyan}  Test Results${colors.reset}`);
    console.log(`${colors.cyan}═══════════════════════════════════════════════════════════════${colors.reset}`);
    
    const total = results.passed + results.failed + results.skipped;
    const passRate = total > 0 ? ((results.passed / total) * 100).toFixed(1) : 0;
    
    console.log(`\n  Total:   ${total} tests`);
    console.log(`  ${colors.green}Passed:  ${results.passed}${colors.reset}`);
    console.log(`  ${colors.red}Failed:  ${results.failed}${colors.reset}`);
    console.log(`  ${colors.yellow}Skipped: ${results.skipped}${colors.reset}`);
    console.log(`  Pass Rate: ${passRate}%`);
    console.log(`  Duration: ${duration.toFixed(2)}s`);
    
    if (results.failed === 0) {
        console.log(`\n  ${colors.green}✓ All tests passed!${colors.reset}\n`);
    } else {
        console.log(`\n  ${colors.red}✗ Some tests failed${colors.reset}\n`);
        
        // Show failed tests
        console.log(`  Failed tests:`);
        for (const suite of results.tests) {
            for (const test of suite.tests) {
                if (test.status === 'failed') {
                    console.log(`    ${colors.red}• ${suite.name} > ${test.name}${colors.reset}`);
                    console.log(`      ${colors.dim}${test.error}${colors.reset}`);
                }
            }
        }
    }
    
    // Write results to file
    const resultsPath = path.join(__dirname, 'test-results.json');
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`\n  Results saved to: ${resultsPath}\n`);
    
    return results;
}

module.exports = {
    describe,
    runAllTests,
    assert,
    TestSuite,
    results
};
