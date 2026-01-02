/**
 * DOM Analysis Strategy
 * 
 * Analyzes the HTML DOM structure to identify interactive elements.
 * Fast and reliable for standard web elements with semantic HTML.
 */

import { BaseStrategy } from '../base/BaseStrategy';
import {
  StrategyType,
  WebElement,
  ElementAction,
  ActionResult,
  IdentificationContext,
  ElementSelector,
  ElementType,
  ElementState
} from '../types';

interface DOMElementInfo {
  tagName: string;
  type?: string;
  id?: string;
  className?: string;
  textContent?: string;
  ariaLabel?: string;
  placeholder?: string;
  role?: string;
  dataTestId?: string;
  bounds: { x: number; y: number; width: number; height: number };
  isVisible: boolean;
  isInteractive: boolean;
}

export class DOMAnalysisStrategy extends BaseStrategy {
  readonly name: StrategyType = 'dom-analysis';

  protected async onInitialize(): Promise<void> {
    this.debug('DOM Analysis strategy initialized');
  }

  async identifyElements(context: IdentificationContext): Promise<WebElement[]> {
    this.debug('Analyzing DOM for interactive elements...');

    try {
      // Extract DOM information from page
      const domElements = await this.extractDOMElements();

      // Filter and score elements based on context
      const relevantElements = this.filterRelevantElements(domElements, context);

      // Convert to WebElement format
      const webElements = relevantElements.map((elem, index) => 
        this.convertDOMElementToWebElement(elem, index)
      );

      this.debug(`Identified ${webElements.length} elements via DOM analysis`);
      return webElements;

    } catch (error) {
      this.debug('DOM analysis failed:', error);
      throw error;
    }
  }

  protected async executeActionInternal(
    element: WebElement,
    action: ElementAction
  ): Promise<ActionResult> {
    const startTime = Date.now();
    const stateBefore = element.state;

    try {
      // Find element using selectors
      const locator = await this.findBestLocator(element);
      
      if (!locator) {
        throw new Error('Could not find element with any selector');
      }

      // Execute action
      switch (action.type) {
        case 'click':
          await locator.click({ timeout: this.config.timeout });
          break;

        case 'type':
          if (action.params?.clearFirst) {
            await locator.clear();
          }
          await locator.fill(action.params?.text || '');
          if (action.params?.pressEnter) {
            await locator.press('Enter');
          }
          break;

        case 'select':
          await locator.selectOption(action.params?.option || '');
          break;

        case 'hover':
          await locator.hover();
          break;

        case 'scroll':
          await locator.scrollIntoViewIfNeeded();
          if (action.params?.scrollAmount) {
            await this.page.mouse.wheel(0, action.params.scrollAmount);
          }
          break;

        case 'extract': {
          const text = await locator.textContent();
          return this.createSuccessResult(stateBefore, 'idle', startTime, {
            extractedText: text || ''
          });
        }

        default:
          throw new Error(`Action type ${action.type} not implemented`);
      }

      // Wait for any navigation or loading
      await this.page.waitForLoadState('networkidle', { timeout: 2000 }).catch(() => {});

      return this.createSuccessResult(stateBefore, 'idle', startTime);

    } catch (error) {
      return this.createErrorResult(
        stateBefore,
        'error',
        startTime,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  getCapabilityScore(context: IdentificationContext): number {
    let score = 0.7; // Base score - DOM analysis is generally reliable

    // Prefer when we have HTML snapshot
    if (context.htmlSnapshot) {
      score += 0.2;
    }

    // Good for structured pages
    const structuredKeywords = ['form', 'input', 'button', 'field'];
    if (structuredKeywords.some(keyword => context.intent.toLowerCase().includes(keyword))) {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Extract interactive elements from DOM
   */
  private async extractDOMElements(): Promise<DOMElementInfo[]> {
    return await this.page.evaluate(() => {
      const elements: DOMElementInfo[] = [];
      
      // Interactive selectors
      const interactiveSelectors = [
        'button',
        'input',
        'textarea',
        'select',
        'a[href]',
        '[role="button"]',
        '[role="link"]',
        '[role="textbox"]',
        '[onclick]',
        '[data-testid]'
      ];

      const allElements = document.querySelectorAll(interactiveSelectors.join(','));

      allElements.forEach((elem) => {
        const htmlElem = elem as HTMLElement;
        const rect = htmlElem.getBoundingClientRect();

        // Check visibility
        const style = window.getComputedStyle(htmlElem);
        const isVisible = 
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          style.opacity !== '0' &&
          rect.width > 0 &&
          rect.height > 0;

        if (!isVisible) {
          return;
        }

        // Extract element info
        const info: DOMElementInfo = {
          tagName: htmlElem.tagName.toLowerCase(),
          type: htmlElem.getAttribute('type') || undefined,
          id: htmlElem.id || undefined,
          className: htmlElem.className || undefined,
          textContent: htmlElem.textContent?.trim().substring(0, 100) || undefined,
          ariaLabel: htmlElem.getAttribute('aria-label') || undefined,
          placeholder: htmlElem.getAttribute('placeholder') || undefined,
          role: htmlElem.getAttribute('role') || undefined,
          dataTestId: htmlElem.getAttribute('data-testid') || undefined,
          bounds: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
          },
          isVisible,
          isInteractive: true
        };

        elements.push(info);
      });

      return elements;
    });
  }

  /**
   * Filter elements relevant to context
   */
  private filterRelevantElements(
    elements: DOMElementInfo[],
    context: IdentificationContext
  ): DOMElementInfo[] {
    const intent = context.intent.toLowerCase();
    const scored = elements.map(elem => ({
      element: elem,
      score: this.scoreElementRelevance(elem, intent)
    }));

    // Sort by score and take top elements
    return scored
      .filter(item => item.score > 0.1)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20) // Limit to top 20
      .map(item => item.element);
  }

  /**
   * Score element relevance to intent
   */
  private scoreElementRelevance(elem: DOMElementInfo, intent: string): number {
    let score = 0.5; // Base score

    // Text content matching
    if (elem.textContent) {
      const text = elem.textContent.toLowerCase();
      const intentWords = intent.split(' ');
      
      for (const word of intentWords) {
        if (word.length > 3 && text.includes(word)) {
          score += 0.2;
        }
      }
    }

    // Aria label matching
    if (elem.ariaLabel) {
      const label = elem.ariaLabel.toLowerCase();
      if (intent.split(' ').some(word => word.length > 3 && label.includes(word))) {
        score += 0.3;
      }
    }

    // Placeholder matching
    if (elem.placeholder) {
      const placeholder = elem.placeholder.toLowerCase();
      if (intent.split(' ').some(word => word.length > 3 && placeholder.includes(word))) {
        score += 0.3;
      }
    }

    // Type matching
    if (intent.includes('button') && elem.tagName === 'button') score += 0.2;
    if (intent.includes('input') && elem.tagName === 'input') score += 0.2;
    if (intent.includes('link') && elem.tagName === 'a') score += 0.2;
    if (intent.includes('dropdown') && elem.tagName === 'select') score += 0.2;

    // Has data-testid (usually important elements)
    if (elem.dataTestId) score += 0.1;

    return Math.min(score, 1.0);
  }

  /**
   * Convert DOM element to WebElement
   */
  private convertDOMElementToWebElement(elem: DOMElementInfo, index: number): WebElement {
    const type = this.mapDOMElementToType(elem);
    const selectors = this.createSelectorsFromDOM(elem);

    return {
      id: `dom-${Date.now()}-${index}`,
      type,
      text: elem.textContent || elem.ariaLabel || elem.placeholder,
      visualDescription: this.buildVisualDescription(elem),
      selectors,
      bounds: elem.bounds,
      state: 'idle',
      confidence: 0.8,
      identifiedBy: this.name
    };
  }

  /**
   * Map DOM element to ElementType
   */
  private mapDOMElementToType(elem: DOMElementInfo): ElementType {
    if (elem.tagName === 'button' || elem.role === 'button') return 'button';
    if (elem.tagName === 'input') {
      if (elem.type === 'checkbox') return 'checkbox';
      if (elem.type === 'radio') return 'radio';
      return 'input';
    }
    if (elem.tagName === 'textarea') return 'textarea';
    if (elem.tagName === 'select') return 'dropdown';
    if (elem.tagName === 'a') return 'link';
    
    return 'container';
  }

  /**
   * Create selectors from DOM element
   */
  private createSelectorsFromDOM(elem: DOMElementInfo): ElementSelector[] {
    const selectors: ElementSelector[] = [];
    let priority = 1;

    // ID selector (highest priority if available)
    if (elem.id) {
      selectors.push({
        type: 'css',
        value: `#${elem.id}`,
        priority: priority++,
        validated: false
      });
    }

    // data-testid (very reliable)
    if (elem.dataTestId) {
      selectors.push({
        type: 'data-testid',
        value: elem.dataTestId,
        priority: priority++,
        validated: false
      });
    }

    // aria-label
    if (elem.ariaLabel) {
      selectors.push({
        type: 'aria-label',
        value: elem.ariaLabel,
        priority: priority++,
        validated: false
      });
    }

    // Text content
    if (elem.textContent && elem.textContent.length < 50) {
      selectors.push({
        type: 'text',
        value: elem.textContent,
        priority: priority++,
        validated: false
      });
    }

    // Class-based selector
    if (elem.className && elem.className.split(' ').length <= 3) {
      const cleanClass = elem.className.split(' ').filter(c => c.length > 0).join('.');
      selectors.push({
        type: 'css',
        value: `${elem.tagName}.${cleanClass}`,
        priority: priority++,
        validated: false
      });
    }

    // Tag name only (lowest priority)
    selectors.push({
      type: 'css',
      value: elem.tagName,
      priority: priority++,
      validated: false
    });

    return selectors;
  }

  /**
   * Build visual description from DOM element
   */
  private buildVisualDescription(elem: DOMElementInfo): string {
    const parts: string[] = [];

    parts.push(elem.tagName);
    
    if (elem.type) parts.push(`type=${elem.type}`);
    if (elem.ariaLabel) parts.push(`"${elem.ariaLabel}"`);
    if (elem.textContent) parts.push(`text="${elem.textContent.substring(0, 30)}"`);
    if (elem.placeholder) parts.push(`placeholder="${elem.placeholder}"`);

    return parts.join(' ');
  }

  /**
   * Find best locator for element
   */
  private async findBestLocator(element: WebElement) {
    for (const selector of element.selectors.sort((a, b) => a.priority - b.priority)) {
      const locator = this.getLocator(selector.type, selector.value);
      
      if (!locator) {
        continue;
      }

      try {
        const count = await locator.count();
        if (count > 0) {
          const isVisible = await locator.first().isVisible();
          if (isVisible) {
            return locator.first();
          }
        }
      } catch {
        // Continue to next selector
      }
    }

    return null;
  }
}
