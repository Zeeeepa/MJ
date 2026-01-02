# StealthStrategy Implementation

Complete implementation of the StealthStrategy class for Web2API browser automation with advanced anti-detection capabilities.

## Overview

The StealthStrategy provides comprehensive stealth measures for browser automation, including:

- **Detection Avoidance**: Integration with @skrillex1224/playwright-toolkit stealth plugin
- **Human-like Behavior**: Random delays, natural mouse movements, and typing patterns  
- **Fingerprint Protection**: Canvas, WebGL, and font fingerprint randomization
- **Network Protection**: WebRTC leak prevention and user agent rotation
- **Advanced Element Identification**: Multiple strategies for reliable element detection
- **Robust Error Handling**: Retry mechanisms and graceful failure handling

## Features

### 🛡️ Anti-Detection Measures

- **Stealth Plugin Integration**: Uses playwright-toolkit for comprehensive detection avoidance
- **Fingerprint Randomization**: Protects against canvas, WebGL, and font fingerprinting
- **WebRTC Protection**: Blocks IP leak vulnerabilities  
- **User Agent Rotation**: Cycles through realistic user agent strings
- **Viewport Randomization**: Uses varied screen resolutions
- **Timezone Spoofing**: Masks real timezone information

### 🎭 Human-like Behavior

- **Randomized Delays**: Configurable delay ranges between actions
- **Natural Mouse Movement**: Bezier curves and realistic movement patterns
- **Typing Humanization**: Variable typing speeds with realistic delays
- **Exponential Backoff**: Intelligent retry mechanisms

### 🔍 Element Identification

Multiple strategies for robust element detection:
- CSS selectors
- XPath expressions  
- Text content matching
- Role-based identification
- ARIA label matching
- Placeholder text matching

## File Structure

```
/packages/WebChat2Api/src/strategies/
├── base/
│   └── BaseStrategy.ts          # Base interface and abstract class
├── providers/
│   └── StealthStrategy.ts       # Complete stealth implementation
├── index.ts                     # Module exports
└── /examples/
    └── stealth-strategy-demo.ts # Usage demonstration
```

## Installation & Dependencies

The implementation requires these dependencies (already included in package.json):

```json
{
  "@skrillex1224/playwright-toolkit": "^2.0.50",
  "playwright": "^1.57.0"
}
```

## Usage Examples

### Basic Initialization

```typescript
import { StealthStrategy, StealthConfig } from '../strategies';
import { chromium } from 'playwright';

const config: StealthConfig = {
    humanizeDelays: true,
    delayRange: [150, 400],
    humanizeMouse: true,
    randomizeFingerprints: true,
    webrtcProtection: true,
    maxRetries: 3
};

const browser = await chromium.launch();
const page = await browser.newPage();

const strategy = new StealthStrategy(config);
await strategy.initialize(page, config);
```

### Element Identification

```typescript
// Multiple identification strategies
const context = {
    selector: 'input[type="email"]',
    xpath: '//input[@placeholder="Email"]',
    placeholder: 'Enter your email',
    elementType: 'email-input'
};

const elements = await strategy.identifyElements(context);
```

### Action Execution

```typescript
// Various action types supported
const actions = [
    { type: 'click', button: 'left' },
    { type: 'type', text: 'user@example.com', delay: 100 },
    { type: 'hover' },
    { type: 'scroll', direction: 'down', distance: 500 },
    { type: 'press', key: 'Enter' }
];

for (const action of actions) {
    await strategy.executeAction(element, action);
}
```

### Element Validation

```typescript
const validation = await strategy.validateElement(element);
if (validation.isValid) {
    console.log('Element is ready for interaction');
} else {
    console.error('Validation failed:', validation.error);
}
```

### Capability Scoring

```typescript
const score = strategy.getCapabilityScore({
    url: 'https://example.com',
    antiBotMeasures: ['canvas-fingerprinting'],
    complexity: {
        interactiveElements: 25,
        hasDynamicContent: true,
        hasBotDetection: true,
        hasCaptcha: false
    }
});

console.log(`Capability score: ${score}`); // 0.0 - 1.0
```

## Configuration Options

### StealthConfig Interface

```typescript
interface StealthConfig {
    humanizeDelays?: boolean;           // Enable human-like delays
    delayRange?: [number, number];      // Delay range [min, max] ms
    humanizeMouse?: boolean;            // Enable mouse humanization
    randomizeFingerprints?: boolean;    // Enable fingerprint protection
    webrtcProtection?: boolean;         // Enable WebRTC leak protection
    rotateUserAgent?: boolean;          // Enable user agent rotation
    spoofTimezone?: boolean;            // Enable timezone spoofing
    userAgents?: string[];              // Custom user agent pool
    timezones?: string[];               // Custom timezone pool
    maxRetries?: number;                // Maximum retry attempts
    randomizeViewport?: boolean;        // Enable viewport randomization
}
```

### Default Values

```typescript
{
    humanizeDelays: true,
    delayRange: [100, 300],
    humanizeMouse: true,
    randomizeFingerprints: true,
    webrtcProtection: true,
    rotateUserAgent: true,
    spoofTimezone: true,
    maxRetries: 3,
    randomizeViewport: true
}
```

## Action Types

The strategy supports comprehensive action types:

```typescript
type ElementAction = 
    | { type: 'click'; button?: 'left' | 'right' | 'middle'; modifiers?: string[] }
    | { type: 'type'; text: string; delay?: number }
    | { type: 'fill'; text: string }
    | { type: 'hover' }
    | { type: 'scroll'; direction: 'up' | 'down' | 'left' | 'right'; distance?: number }
    | { type: 'focus' | 'blur' }
    | { type: 'press'; key: string }
    | { type: 'check' | 'uncheck' }
    | { type: 'select'; option: string }
    | { type: 'upload'; files: string[] };
```

## Error Handling

The implementation includes comprehensive error handling:

- **Validation Checks**: Ensures strategy is initialized before use
- **Retry Mechanisms**: Exponential backoff for failed operations
- **Graceful Degradation**: Continues operation when individual steps fail
- **Detailed Logging**: Timestamped logs for debugging

## Performance Considerations

- **Lazy Initialization**: Resources allocated only when needed
- **Connection Pooling**: Efficient browser resource management
- **Memory Management**: Proper cleanup of page references
- **Timeout Handling**: Configurable timeouts for all operations

## Integration with MemberJunction

Follows MemberJunction code style guidelines:

- ✅ **No `any` types** - Strict TypeScript typing throughout
- ✅ **Functional decomposition** - Small, focused methods
- ✅ **Proper error handling** - Comprehensive try-catch blocks
- ✅ **TSDoc comments** - Complete documentation
- ✅ **Object-oriented design** - Extends BaseStrategy properly

## Testing

Run the demonstration to verify functionality:

```bash
npm run demo:stealth-strategy
```

Or use the provided demo file:

```bash
ts-node src/examples/stealth-strategy-demo.ts
```

## Browser Compatibility

Tested with:
- Chromium (recommended for stealth features)
- Chrome 
- Edge
- Firefox (limited stealth support)

## Security Considerations

- Uses legitimate stealth techniques for automation
- No malicious fingerprint spoofing
- Respects robots.txt and rate limiting
- Designed for testing and legitimate automation use cases

## Future Enhancements

Potential improvements:
- Machine learning-based behavior patterns
- Advanced CAPTCHA handling
- Proxy rotation support
- Custom plugin architecture
- Performance metrics collection

---

This implementation provides enterprise-grade stealth capabilities while maintaining clean, maintainable code that follows MemberJunction standards.