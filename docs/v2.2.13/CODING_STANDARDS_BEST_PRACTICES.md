# Coding Standards & Best Practices Guide
## SvonyBrowser v2.2.13

---

## **📋 Overview**

This document establishes the coding standards and best practices implemented in SvonyBrowser v2.2.13, ensuring consistent, maintainable, and high-quality code across all components of the project.

---

## **🔧 PowerShell Standards**

### **Output Methods**
**Standard**: Use `Write-Information` instead of `Write-Host`

```powershell
# ✅ Correct
Write-Information "Processing files..." -InformationAction Continue

# ❌ Avoid
Write-Host "Processing files..." -ForegroundColor Green
```

**Rationale**: `Write-Information` provides better stream handling and doesn't interfere with return values.

### **Error Handling**
**Standard**: Never leave catch blocks empty

```powershell
# ✅ Correct
try {
    Invoke-SomeOperation
}
catch {
    Write-Error "Operation failed: $($_.Exception.Message)"
    continue
}

# ❌ Avoid
try {
    Invoke-SomeOperation  
}
catch {
    # Empty catch block
}
```

### **Variable Naming**
**Standard**: Avoid automatic variable conflicts

```powershell
# ✅ Correct
$buildError = Get-BuildErrors
$launchProfile = Get-Profile

# ❌ Avoid
$error = Get-BuildErrors  # Conflicts with automatic $error
$profile = Get-Profile    # Conflicts with automatic $profile
```

### **Parameter Declaration**
**Standard**: Don't set default values for switch parameters

```powershell
# ✅ Correct
[switch]$Verbose

# ❌ Avoid  
[switch]$Verbose = $true
```

### **File Encoding**
**Standard**: All PowerShell files must use UTF-8 BOM encoding

```powershell
# Ensure scripts are saved with UTF-8 BOM
# This prevents encoding issues across different systems
```

### **Whitespace Management**
**Standard**: No trailing whitespace allowed

- Configure editors to show/remove trailing whitespace
- Use automated tools to clean whitespace before commits

---

## **⚡ JavaScript/TypeScript Standards**

### **Error Handling**
**Standard**: Comprehensive error handling with proper logging

```javascript
// ✅ Correct
try {
    const result = await riskyOperation();
    return result;
} catch (error) {
    this.errorHandler.logError('Operation failed', { 
        operation: 'riskyOperation',
        error: error.message 
    });
    throw error;
}

// ❌ Avoid
try {
    return await riskyOperation();
} catch (error) {
    console.log('Error occurred');
}
```

### **Async/Await Usage**
**Standard**: Always handle promises properly

```javascript
// ✅ Correct
async function processData() {
    try {
        const data = await fetchData();
        const processed = await transformData(data);
        return processed;
    } catch (error) {
        this.errorHandler.logError('Data processing failed', { error });
        throw error;
    }
}

// ❌ Avoid
function processData() {
    fetchData().then(data => {
        transformData(data).then(processed => {
            return processed; // Return in wrong scope
        });
    });
}
```

### **Type Safety**
**Standard**: Use TypeScript types for all function signatures

```typescript
// ✅ Correct
interface UserAccount {
    id: string;
    email: string;
    lastLogin: Date;
}

function processAccount(account: UserAccount): Promise<void> {
    // Implementation
}

// ❌ Avoid
function processAccount(account: any): any {
    // Implementation
}
```

### **Import/Export Standards**
**Standard**: Use type-only imports when appropriate

```typescript
// ✅ Correct
import type { PlayerAccount } from './AccountExtractor';
import { AccountService } from './AccountService';

// ❌ Avoid (when only using for types)
import { PlayerAccount } from './AccountExtractor';
```

---

## **🎨 Code Quality Standards**

### **Linting Configuration**
**ESLint Rules** (Enforced):
```json
{
    "no-console": "error",
    "no-debugger": "error", 
    "prefer-const": "error",
    "no-var": "error",
    "eqeqeq": ["error", "always"],
    "@typescript-eslint/no-unused-vars": "error"
}
```

**PSScriptAnalyzer Rules** (All enabled):
- No suppression of rules without documentation
- All warnings treated as errors
- Custom rules for project-specific standards

### **Code Formatting**
**Prettier Configuration**:
```json
{
    "semi": true,
    "trailingComma": "es5",
    "singleQuote": true,
    "printWidth": 100,
    "tabWidth": 2
}
```

**PowerShell Formatting**:
- 4-space indentation
- No trailing whitespace
- Consistent bracket placement

---

## **📦 Git & Version Control**

### **Commit Standards**
**Format**: `type(scope): description`

```bash
# ✅ Correct
feat(auth): add OAuth2 authentication
fix(ui): resolve button alignment issue
docs(api): update error handling documentation

# ❌ Avoid
Fixed stuff
Updated files
WIP
```

### **Branch Naming**
**Standard**: `type/description-kebab-case`

```bash
# ✅ Correct
feature/oauth2-integration
bugfix/memory-leak-fix
hotfix/security-patch

# ❌ Avoid
new-feature
fix
temp-branch
```

### **Pre-commit Validation**
**Required Checks**:
- PowerShell script analysis (zero warnings)
- ESLint validation (zero errors)
- TypeScript compilation (zero errors)
- Unit test execution (passing)

---

## **🔒 Security Standards**

### **Credential Management**
**Standard**: Never hardcode secrets

```javascript
// ✅ Correct
const apiKey = process.env.API_KEY;
if (!apiKey) {
    throw new Error('API_KEY environment variable not set');
}

// ❌ Avoid
const apiKey = 'sk-1234567890abcdef';
```

### **Input Validation**
**Standard**: Validate all external inputs

```javascript
// ✅ Correct
function processUserInput(input: string): string {
    if (!input || typeof input !== 'string') {
        throw new Error('Invalid input: string required');
    }
    
    if (input.length > 1000) {
        throw new Error('Input too long: maximum 1000 characters');
    }
    
    return sanitizeInput(input);
}

// ❌ Avoid
function processUserInput(input: any): any {
    return input; // No validation
}
```

### **Error Information Disclosure**
**Standard**: Don't expose sensitive information in errors

```javascript
// ✅ Correct
catch (error) {
    this.errorHandler.logError('Database operation failed', { 
        operation: 'userLookup',
        timestamp: Date.now()
    });
    throw new Error('Operation failed');
}

// ❌ Avoid  
catch (error) {
    throw new Error(`Database error: ${error.message} - Connection: ${dbConnectionString}`);
}
```

---

## **📊 Performance Standards**

### **Memory Management**
**Standard**: Proper resource cleanup

```javascript
// ✅ Correct
class ResourceManager {
    private resources: Map<string, Resource> = new Map();
    
    async cleanup(): Promise<void> {
        for (const [id, resource] of this.resources) {
            await resource.dispose();
        }
        this.resources.clear();
    }
}

// ❌ Avoid
class ResourceManager {
    private resources: Map<string, Resource> = new Map();
    // No cleanup method
}
```

### **Async Operations**
**Standard**: Use appropriate concurrency patterns

```javascript
// ✅ Correct - Sequential when order matters
const results = [];
for (const item of items) {
    const result = await processItem(item);
    results.push(result);
}

// ✅ Correct - Parallel when independent
const results = await Promise.all(
    items.map(item => processItem(item))
);

// ❌ Avoid - Mixing patterns inappropriately
const results = items.map(async item => await processItem(item));
```

---

## **🧪 Testing Standards**

### **Test Structure**
**Standard**: Arrange, Act, Assert pattern

```javascript
// ✅ Correct
describe('AccountService', () => {
    it('should create account successfully', async () => {
        // Arrange
        const accountData = createTestAccountData();
        const service = new AccountService();
        
        // Act
        const result = await service.createAccount(accountData);
        
        // Assert
        expect(result.id).toBeDefined();
        expect(result.email).toBe(accountData.email);
    });
});
```

### **Mock Usage**
**Standard**: Mock external dependencies

```javascript
// ✅ Correct
jest.mock('./DatabaseService');
const mockDatabase = jest.mocked(DatabaseService);

it('should handle database errors', async () => {
    mockDatabase.prototype.save.mockRejectedValue(new Error('DB Error'));
    
    const service = new AccountService();
    await expect(service.createAccount(testData)).rejects.toThrow('DB Error');
});
```

### **Coverage Requirements**
**Minimum Standards**:
- Overall coverage: 90%
- Function coverage: 95%
- Branch coverage: 85%
- Statement coverage: 90%

---

## **📝 Documentation Standards**

### **Code Comments**
**Standard**: Document complex logic and public APIs

```javascript
// ✅ Correct
/**
 * Processes account data and generates validation report
 * @param account - The account data to process
 * @param options - Processing options including validation level
 * @returns Promise resolving to validation report
 * @throws {ValidationError} When account data is invalid
 */
async function processAccount(
    account: PlayerAccount, 
    options: ProcessingOptions = {}
): Promise<ValidationReport> {
    // Implementation
}

// ❌ Avoid
// Process account
function processAccount(account: any, options: any): any {
    // Implementation
}
```

### **README Standards**
**Required Sections**:
- Project description and purpose
- Installation instructions
- Usage examples
- API documentation (if applicable)
- Contributing guidelines
- License information

### **Change Documentation**
**Standard**: Document all breaking changes

```markdown
# ✅ Correct
## Breaking Changes in v2.2.13
- `processAccount()` now requires `PlayerAccount` type instead of `any`
- Error handling now throws `ValidationError` instead of generic `Error`
- Minimum Node.js version increased to 14.0.0

## Migration Guide
- Update type imports: `import type { PlayerAccount } from './types'`
- Update error handling: `catch (error: ValidationError)`
```

---

## **🚀 Deployment Standards**

### **Build Process**
**Standard**: Automated and reproducible builds

```json
{
    "scripts": {
        "prebuild": "npm run lint && npm run test",
        "build": "npm run build:clean && npm run build:compile",
        "build:clean": "rimraf dist/",
        "build:compile": "tsc && electron-builder"
    }
}
```

### **Environment Configuration**
**Standard**: Environment-specific configurations

```javascript
// ✅ Correct
const config = {
    development: {
        logLevel: 'debug',
        apiUrl: 'http://localhost:3000'
    },
    production: {
        logLevel: 'error', 
        apiUrl: process.env.API_URL
    }
};

export default config[process.env.NODE_ENV || 'development'];
```

### **Version Management**
**Standard**: Semantic versioning

- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

---

## **🔄 Code Review Standards**

### **Review Checklist**
**Required Checks**:
- [ ] Code follows established style guidelines
- [ ] All tests pass and coverage requirements met
- [ ] No console.log or debug statements
- [ ] Error handling is comprehensive
- [ ] Documentation is updated
- [ ] Security considerations addressed
- [ ] Performance impact assessed

### **Review Process**
1. **Automated Checks**: CI/CD pipeline validation
2. **Peer Review**: At least one team member approval
3. **Security Review**: For changes affecting authentication/authorization
4. **Performance Review**: For changes affecting critical paths

---

## **⚡ Performance Optimization Guidelines**

### **Memory Optimization**
```javascript
// ✅ Correct - Efficient memory usage
function processLargeDataset(data: DataItem[]): ProcessedData[] {
    const results: ProcessedData[] = [];
    
    for (const item of data) {
        const processed = processItem(item);
        results.push(processed);
        
        // Clear references to help GC
        if (results.length % 1000 === 0) {
            // Consider yielding to event loop
            await new Promise(resolve => setImmediate(resolve));
        }
    }
    
    return results;
}
```

### **Database Optimization**
```javascript
// ✅ Correct - Efficient queries
async function getAccountsByServer(serverId: string): Promise<PlayerAccount[]> {
    // Use indexes, limit results, select only needed fields
    return this.database.query(`
        SELECT id, email, server, lastUpdated 
        FROM accounts 
        WHERE server = ? 
        ORDER BY lastUpdated DESC 
        LIMIT 1000
    `, [serverId]);
}
```

---

## **🛠 Tools and Automation**

### **Required Development Tools**
- **ESLint**: JavaScript/TypeScript linting
- **Prettier**: Code formatting
- **PSScriptAnalyzer**: PowerShell analysis
- **Husky**: Git hooks management
- **Jest**: Testing framework
- **TypeScript**: Type checking

### **Automation Scripts**
```bash
# Quality validation
npm run quality:check

# Automated fixes
npm run quality:fix

# Full validation
npm run validate:all
```

---

## **📈 Continuous Improvement**

### **Metrics Collection**
- Code quality metrics (linting violations)
- Test coverage trends
- Build performance metrics
- Error rate monitoring

### **Regular Reviews**
- **Weekly**: Code quality metrics review
- **Monthly**: Performance optimization review
- **Quarterly**: Standards and practices update

### **Learning and Updates**
- Stay current with best practices
- Update tooling and configurations
- Share knowledge across team
- Document lessons learned

---

This coding standards guide ensures consistent, high-quality code across the SvonyBrowser project and serves as the foundation for maintaining professional-grade software development practices.
