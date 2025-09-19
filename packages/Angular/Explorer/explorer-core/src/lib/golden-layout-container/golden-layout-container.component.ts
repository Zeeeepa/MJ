import {
  Component,
  ViewChild,
  ViewContainerRef,
  ElementRef,
  OnInit,
  OnDestroy,
  Input,
  Output,
  EventEmitter,
  AfterViewInit,
  HostListener
} from '@angular/core';
import { GoldenLayoutService, PanelComponent, PanelComponentState } from '../services/golden-layout.service';
import { LayoutConfig, ResolvedLayoutConfig } from 'golden-layout';
import { ResourceData } from '@memberjunction/core-entities';
import { Subscription } from 'rxjs';

export interface PanelClosedEvent {
  panelId: string;
  resourceData?: ResourceData;
  newFocusPanelId?: string;
  done: (error?: any) => void;
}

export interface PanelSelectedEvent {
  panel: PanelComponent;
  resourceData?: ResourceData;
}

@Component({
  selector: 'mj-golden-layout-container',
  templateUrl: './golden-layout-container.component.html',
  styleUrls: ['./golden-layout-container.component.css']
})
export class GoldenLayoutContainerComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('goldenLayoutContainer', { static: true }) containerElement!: ElementRef;
  @ViewChild('viewContainer', { read: ViewContainerRef, static: true }) viewContainerRef!: ViewContainerRef;

  @Input() initialLayout?: LayoutConfig;
  @Input() fillWidth: boolean = true;
  @Input() fillHeight: boolean = true;

  @Output() layoutChanged = new EventEmitter<ResolvedLayoutConfig>();
  @Output() panelClosed = new EventEmitter<PanelClosedEvent>();
  @Output() panelSelected = new EventEmitter<PanelSelectedEvent>();
  @Output() panelCreated = new EventEmitter<PanelComponent>();
  @Output() resizeContainer = new EventEmitter<void>();

  private subscriptions: Subscription[] = [];
  private resizeTimeout: any;

  constructor(
    private goldenLayoutService: GoldenLayoutService
  ) {}

  ngOnInit(): void {
    // Subscribe to Golden Layout events
    this.subscriptions.push(
      this.goldenLayoutService.layoutChanged.subscribe(layout => {
        this.layoutChanged.emit(layout);
      })
    );

    this.subscriptions.push(
      this.goldenLayoutService.panelCreated.subscribe(panel => {
        this.panelCreated.emit(panel);
      })
    );

    this.subscriptions.push(
      this.goldenLayoutService.panelDestroyed.subscribe(panelId => {
        const event: PanelClosedEvent = {
          panelId,
          done: (error?: any) => {
            if (error) {
              console.error('Error closing panel:', error);
            }
          }
        };
        this.panelClosed.emit(event);
      })
    );

    this.subscriptions.push(
      this.goldenLayoutService.panelSelected.subscribe(panel => {
        const event: PanelSelectedEvent = {
          panel,
          resourceData: panel.state.resourceData
        };
        this.panelSelected.emit(event);
      })
    );
  }

  ngAfterViewInit(): void {
    // Initialize Golden Layout with the container element
    setTimeout(() => {
      console.log('Initializing Golden Layout...');
      this.initializeGoldenLayout();
    }, 100); // Increase delay slightly to ensure DOM is ready
  }

  ngOnDestroy(): void {
    // Clean up subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());

    // Destroy Golden Layout
    this.goldenLayoutService.destroy();

    // Clear resize timeout
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
    }
    this.resizeTimeout = setTimeout(() => {
      this.updateSize();
      this.resizeContainer.emit();
    }, 200);
  }

  /**
   * Add a new panel to the layout
   */
  public addPanel(componentState: PanelComponentState, location?: 'root' | 'split-right' | 'split-bottom' | 'stack'): void {
    console.log('GoldenLayoutContainerComponent.addPanel called with:', componentState);
    try {
      this.goldenLayoutService.addPanel(componentState, location);
      console.log('Panel added successfully');
    } catch (error) {
      console.error('Error adding panel:', error);
    }
  }

  /**
   * Close a panel by its ID
   */
  public closePanel(panelId: string): void {
    this.goldenLayoutService.closePanel(panelId);
  }

  /**
   * Focus a panel by its ID
   */
  public focusPanel(panelId: string): void {
    this.goldenLayoutService.focusPanel(panelId);
  }

  /**
   * Find a panel by resource data
   */
  public findPanelByResource(resourceData: ResourceData): PanelComponent | undefined {
    return this.goldenLayoutService.findPanelByResource(resourceData);
  }

  /**
   * Get all active panels
   */
  public getActivePanels(): PanelComponent[] {
    return this.goldenLayoutService.getActivePanels();
  }

  /**
   * Get the current layout configuration
   */
  public getLayout(): ResolvedLayoutConfig | null {
    return this.goldenLayoutService.getLayout();
  }

  /**
   * Load a layout configuration
   */
  public loadLayout(config: LayoutConfig): void {
    this.goldenLayoutService.loadLayout(config);
  }

  /**
   * Split the active panel
   */
  public splitActivePanel(direction: 'horizontal' | 'vertical'): void {
    this.goldenLayoutService.splitActivePanel(direction);
  }

  /**
   * Update the size of the Golden Layout container
   */
  public updateSize(): void {
    const container = this.containerElement.nativeElement;
    if (container) {
      // Golden Layout will automatically adjust to container size
      // Trigger a resize event to update internal dimensions
      window.dispatchEvent(new Event('resize'));
    }
  }

  /**
   * Initialize Golden Layout
   */
  private initializeGoldenLayout(): void {
    const container = this.containerElement.nativeElement;
    console.log('Container element:', container);
    console.log('Container dimensions:', container.offsetWidth, 'x', container.offsetHeight);

    // Set up default layout - start with an empty stack
    const defaultLayout: LayoutConfig = this.initialLayout || {
      root: {
        type: 'stack',
        content: []
      }
    };

    console.log('Initializing with layout:', defaultLayout);

    // Initialize Golden Layout
    this.goldenLayoutService.initialize(container, this.viewContainerRef, defaultLayout);
  }
}