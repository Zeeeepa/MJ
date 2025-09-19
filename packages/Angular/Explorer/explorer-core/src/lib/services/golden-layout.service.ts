import { Injectable, ComponentRef, ViewContainerRef, Type, EventEmitter, Component } from '@angular/core';
import { GoldenLayout, LayoutConfig, ComponentContainer, ComponentItemConfig, ResolvedLayoutConfig } from 'golden-layout';
import * as $ from 'jquery';
import { Subject, BehaviorSubject } from 'rxjs';
import { ResourceData } from '@memberjunction/core-entities';

// Make jQuery available globally as required by Golden Layout
declare global {
  interface Window {
    $: any;
    jQuery: any;
  }
}
window.$ = window.jQuery = $;

export interface PanelComponentState {
  resourceData?: ResourceData;
  componentType?: string;
  label?: string;
  icon?: string;
  id?: string;
  workspaceItemId?: string;
}

export interface PanelComponent {
  componentRef: ComponentRef<any>;
  container: ComponentContainer;
  state: PanelComponentState;
}

@Injectable({
  providedIn: 'root'
})
export class GoldenLayoutService {
  private goldenLayout: GoldenLayout | null = null;
  private componentRegistry = new Map<string, Type<any>>();
  private activeComponents = new Map<string, PanelComponent>();
  private viewContainerRef: ViewContainerRef | null = null;

  // Events
  public layoutChanged = new Subject<ResolvedLayoutConfig>();
  public panelCreated = new EventEmitter<PanelComponent>();
  public panelDestroyed = new EventEmitter<string>();
  public panelSelected = new EventEmitter<PanelComponent>();
  public layoutInitialized = new BehaviorSubject<boolean>(false);

  constructor() {}

  /**
   * Initialize Golden Layout with a container element and view container ref
   */
  public initialize(container: HTMLElement, viewContainerRef: ViewContainerRef, config?: LayoutConfig): void {
    console.log('GoldenLayoutService.initialize called');

    try {
      this.viewContainerRef = viewContainerRef;

      // Check container dimensions
      if (!container.offsetWidth || !container.offsetHeight) {
        console.error('Container has no dimensions:', container.offsetWidth, 'x', container.offsetHeight);
        // Set minimum dimensions
        container.style.width = '100%';
        container.style.height = '500px';
        container.style.minHeight = '500px';
      }

      // Default configuration if none provided
      const defaultConfig: LayoutConfig = {
        root: {
          type: 'row',
          content: []
        }
      };

      const layoutConfig = config || defaultConfig;
      console.log('Layout config:', layoutConfig);

      // Initialize Golden Layout
      this.goldenLayout = new GoldenLayout(container);
      console.log('Golden Layout instance created');

      // Note: Home placeholder component will be registered by the NavigationComponent

      // Register component creation callback with unbind handler
      this.goldenLayout.registerComponentFactoryFunction('angular-component', (container: ComponentContainer, state?: any) => {
        console.log('GoldenLayout creating component with state:', state);
        console.log('State resourceData:', state?.resourceData);
        console.log('State resourceData Configuration:', state?.resourceData?.Configuration);
        const bindableComponent = this.createComponent(container, state as PanelComponentState);

        // Set up unbind handler for cleanup
        container.on('destroy', () => {
          this.destroyComponent(container);
        });

        return bindableComponent;
      });

      // Setup event handlers
      this.setupEventHandlers();

      // Load the initial layout
      console.log('Loading layout...');
      this.goldenLayout.loadLayout(layoutConfig);
      console.log('Layout loaded successfully');

      this.layoutInitialized.next(true);
    } catch (error) {
      console.error('Error initializing Golden Layout:', error);
      throw error;
    }
  }

  /**
   * Register an Angular component type for use in Golden Layout
   */
  public registerComponent(name: string, componentType: Type<any>): void {
    this.componentRegistry.set(name, componentType);
  }

  /**
   * Create a new panel with the specified component
   */
  public addPanel(componentState: PanelComponentState, location: 'root' | 'split-right' | 'split-bottom' | 'stack' = 'stack'): void {
    if (!this.goldenLayout) {
      throw new Error('Golden Layout not initialized');
    }


    const componentConfig: ComponentItemConfig = {
      type: 'component',
      componentType: 'angular-component',
      componentState: componentState,
      title: componentState.label || 'New Panel',
      id: componentState.id || this.generatePanelId()
    };

    // Golden Layout v2 uses addComponent method
    try {
      this.goldenLayout.addComponent(
        componentConfig.componentType!,
        componentConfig.componentState,
        componentConfig.title
      );
    } catch (error) {
      console.error('Error adding panel:', error);
    }
  }

  /**
   * Close a panel by its ID
   */
  public closePanel(panelId: string): void {
    const panel = this.activeComponents.get(panelId);
    if (panel) {
      panel.container.close();
    }
  }

  /**
   * Focus/select a panel by its ID
   */
  public focusPanel(panelId: string): void {
    const panel = this.activeComponents.get(panelId);
    if (panel) {
      panel.container.focus();
    }
  }

  /**
   * Get the current layout configuration
   */
  public getLayout(): ResolvedLayoutConfig | null {
    return this.goldenLayout?.saveLayout() || null;
  }

  /**
   * Load a layout configuration
   */
  public loadLayout(config: LayoutConfig): void {
    if (this.goldenLayout) {
      this.goldenLayout.loadLayout(config);
    }
  }

  /**
   * Find a panel by resource data
   * Matches the logic from findExistingTab in navigation.component.ts
   */
  public findPanelByResource(resourceData: ResourceData): PanelComponent | undefined {
    for (const panel of this.activeComponents.values()) {
      const panelData = panel.state.resourceData;
      if (!panelData) continue;

      // For drawer items, match by drawerItemType
      if (resourceData.Configuration?.isDrawerItem && panelData.Configuration?.isDrawerItem) {
        if (panelData.Configuration.drawerItemType === resourceData.Configuration.drawerItemType) {
          return panel;
        }
      }
      // For application views, match by appName and entityName
      else if (resourceData.Configuration?.isApplicationView && panelData.Configuration?.isApplicationView) {
        if (panelData.Configuration.appName === resourceData.Configuration.appName &&
            panelData.Configuration.entityName === resourceData.Configuration.entityName) {
          return panel;
        }
      }
      // Special matching for search results
      else if (resourceData.ResourceType?.trim().toLowerCase() === 'search results') {
        if (panelData.ResourceTypeID === resourceData.ResourceTypeID &&
            panelData.Configuration?.Entity === resourceData.Configuration?.Entity &&
            panelData.Configuration?.SearchInput === resourceData.Configuration?.SearchInput) {
          return panel;
        }
      }
      // Special matching for user views
      else if (resourceData.ResourceType?.trim().toLowerCase() === 'user views') {
        if (resourceData.ResourceRecordID) {
          // Saved view - match by ResourceTypeID and ResourceRecordID
          if (panelData.ResourceTypeID === resourceData.ResourceTypeID &&
              panelData.ResourceRecordID === resourceData.ResourceRecordID &&
              resourceData.ResourceRecordID !== null &&
              resourceData.ResourceRecordID !== undefined) {
            return panel;
          }
        } else {
          // Dynamic view - match by entity and extra filter
          if (panelData.ResourceTypeID === resourceData.ResourceTypeID &&
              panelData.Configuration?.Entity === resourceData.Configuration?.Entity &&
              panelData.Configuration?.ExtraFilter === resourceData.Configuration?.ExtraFilter) {
            return panel;
          }
        }
      }
      // Default matching for other resources
      else {
        // Match by ResourceTypeID and ResourceRecordID, checking all Configuration keys
        if (panelData.ResourceTypeID === resourceData.ResourceTypeID &&
            panelData.ResourceRecordID === resourceData.ResourceRecordID) {
          // Check if Configuration keys match (ignoring underscore-prefixed and newrecordvalues)
          let configMatch = true;
          const keys = Object.keys(resourceData.Configuration || {})
            .filter(k => !k.startsWith('_') && k.trim().toLowerCase() !== 'newrecordvalues');

          for (const key of keys) {
            if (resourceData.Configuration?.[key] !== panelData.Configuration?.[key]) {
              configMatch = false;
              break;
            }
          }

          if (configMatch) {
            return panel;
          }
        }
      }
    }
    return undefined;
  }

  /**
   * Get all active panels
   */
  public getActivePanels(): PanelComponent[] {
    return Array.from(this.activeComponents.values());
  }

  /**
   * Destroy Golden Layout instance
   */
  public destroy(): void {
    if (this.goldenLayout) {
      // Clean up all components
      this.activeComponents.forEach(panel => {
        panel.componentRef.destroy();
      });
      this.activeComponents.clear();

      // Destroy Golden Layout
      this.goldenLayout.destroy();
      this.goldenLayout = null;
      this.layoutInitialized.next(false);
    }
  }

  /**
   * Split the active panel
   */
  public splitActivePanel(direction: 'horizontal' | 'vertical'): void {
    if (!this.goldenLayout) return;

    // For now, just add a new component
    // Golden Layout v2 handles splitting differently
    try {
      this.goldenLayout.addComponent(
        'angular-component',
        { label: 'New Panel' },
        'New Panel'
      );
    } catch (error) {
      console.error('Error splitting panel:', error);
    }
  }

  /**
   * Create an Angular component in a Golden Layout container
   */
  private createComponent(container: ComponentContainer, state: PanelComponentState): any {
    if (!this.viewContainerRef) {
      throw new Error('ViewContainerRef not set');
    }

    // Get the component type from registry
    const componentType = this.componentRegistry.get(state?.componentType || 'panel-wrapper');
    if (!componentType) {
      console.warn(`Component type ${state?.componentType || 'unknown'} not registered, using default`);
      // Return a bindable component with fallback
      const fallback = document.createElement('div');
      fallback.innerHTML = '<div style="padding: 20px; text-align: center;">Component not found</div>';
      fallback.style.width = '100%';
      fallback.style.height = '100%';
      fallback.style.position = 'absolute';
      fallback.style.left = '0';
      fallback.style.top = '0';
      container.element.appendChild(fallback);
      return {
        component: fallback,
        virtual: false
      };
    }

    // Create the component
    const componentRef = this.viewContainerRef.createComponent(componentType);

    // Pass the resource data to the component using setInput (Angular 14+)
    const panelId = state?.id || this.generatePanelId();

    // Always try to set the data
    const dataToSet = state?.resourceData || null;

    console.log('GoldenLayout createComponent - dataToSet:', dataToSet);
    console.log('GoldenLayout createComponent - dataToSet Configuration:', dataToSet?.Configuration);

    // Try using setInput if available (Angular 14+)
    if (typeof componentRef.setInput === 'function') {
      componentRef.setInput('Data', dataToSet);
      componentRef.setInput('panelId', panelId);
      // Don't set isVisible - let PanelWrapper handle it
      console.log('Used setInput to set Data');
    } else {
      // Fallback to direct property assignment
      componentRef.instance.Data = dataToSet;
      componentRef.instance.panelId = panelId;
      // Don't set isVisible - let PanelWrapper handle it
      console.log('Used direct assignment to set Data');
    }

    // Trigger change detection to ensure inputs are processed
    componentRef.changeDetectorRef.markForCheck();
    componentRef.changeDetectorRef.detectChanges();

    // Store the component reference
    const panel: PanelComponent = {
      componentRef,
      container,
      state
    };
    this.activeComponents.set(panelId, panel);

    // Virtual component pattern - append the component's element to the container
    const componentElement = componentRef.location.nativeElement;

    // Set up virtual component positioning
    componentElement.style.position = 'absolute';
    componentElement.style.width = '100%';
    componentElement.style.height = '100%';
    componentElement.style.left = '0';
    componentElement.style.top = '0';

    // Append to container element
    container.element.appendChild(componentElement);

    // Set up container events for virtual components
    container.virtualRectingRequiredEvent = (container, width, height) => {
      // Update component size
      componentElement.style.width = width + 'px';
      componentElement.style.height = height + 'px';
    };

    container.virtualVisibilityChangeRequiredEvent = (container, visible) => {
      // Update component visibility
      componentElement.style.display = visible ? 'block' : 'none';
    };

    container.virtualZIndexChangeRequiredEvent = (container, logicalZIndex, defaultZIndex) => {
      // Update component z-index
      componentElement.style.zIndex = defaultZIndex;
    };

    // Emit panel created event
    this.panelCreated.emit(panel);

    // Return bindable component object for Golden Layout
    return {
      component: componentRef.instance,
      virtual: true
    };
  }

  /**
   * Setup Golden Layout event handlers
   */
  private setupEventHandlers(): void {
    if (!this.goldenLayout) return;

    this.goldenLayout.on('stateChanged', () => {
      const layout = this.goldenLayout?.saveLayout();
      if (layout) {
        this.layoutChanged.next(layout);
      }
    });
  }

  /**
   * Generate a unique panel ID
   */
  private generatePanelId(): string {
    return `panel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Destroy an Angular component when its container is destroyed
   */
  private destroyComponent(container: ComponentContainer): void {
    // Find the panel by container
    let panelToRemove: string | undefined;
    for (const [panelId, panel] of this.activeComponents.entries()) {
      if (panel.container === container) {
        panelToRemove = panelId;
        break;
      }
    }

    if (panelToRemove) {
      const panel = this.activeComponents.get(panelToRemove)!;

      // Remove the component's DOM element from container
      const componentElement = panel.componentRef.location.nativeElement;
      if (componentElement.parentElement === container.element) {
        container.element.removeChild(componentElement);
      }

      // Destroy the Angular component
      panel.componentRef.destroy();

      // Remove from active components
      this.activeComponents.delete(panelToRemove);

      // Emit panel destroyed event
      this.panelDestroyed.emit(panelToRemove);
    }
  }
}