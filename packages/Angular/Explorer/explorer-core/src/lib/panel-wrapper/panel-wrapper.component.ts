import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ChangeDetectorRef, ViewChild, ViewContainerRef, Type } from '@angular/core';
import { ResourceData } from '@memberjunction/core-entities';
import { Metadata, ApplicationInfo } from '@memberjunction/core';
import { HomeWrapperComponent } from '../home-wrapper/home-wrapper.component';
import { SettingsComponent } from '@memberjunction/ng-explorer-settings';
import { SkipChatWrapperComponent } from '@memberjunction/ng-ask-skip';
import { FilesComponent } from '../files/files.component';
import { ListViewComponent } from '../list-view/list-view.component';
import { DataBrowserComponent } from '../data-browser-component/data-browser.component';
import { SingleApplicationComponent } from '../single-application/single-application.component';
import { DashboardBrowserComponent } from '../dashboard-browser-component/dashboard-browser.component';
import { ReportBrowserComponent } from '../report-browser-component/report-browser.component';
import { QueryBrowserComponent } from '../query-browser-component/query-browser.component';

/**
 * Wrapper component for panel content in Golden Layout.
 * This component wraps the resource container and provides
 * a consistent interface for all panels.
 */
@Component({
  selector: 'mj-panel-wrapper',
  templateUrl: './panel-wrapper.component.html',
  styleUrls: ['./panel-wrapper.component.css']
})
export class PanelWrapperComponent implements OnInit, OnDestroy {
  @Input() Data?: ResourceData;
  @Input() isVisible: boolean = false; // Start with false to trigger load
  @Input() panelId?: string;

  @Output() ResourceRecordSaved = new EventEmitter<any>();
  @Output() ContentLoadingStarted = new EventEmitter<void>();
  @Output() ContentLoadingComplete = new EventEmitter<void>();

  @ViewChild('dynamicComponentContainer', { read: ViewContainerRef, static: true })
  dynamicComponentContainer!: ViewContainerRef;

  public contentLoading: boolean = false;
  public shouldShowSpecialComponent: boolean = false;
  private componentRef: any;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    console.log('PanelWrapper ngOnInit - Full Data object:', this.Data);
    console.log('PanelWrapper ngOnInit - Configuration:', this.Data?.Configuration);
    console.log('PanelWrapper ngOnInit - ResourceType:', this.Data?.ResourceType);
    console.log('PanelWrapper ngOnInit - ResourceTypeID:', this.Data?.ResourceTypeID);

    // Check if this is a resource browser (Dashboards, Reports, Queries)
    const isResourceBrowser = this.Data?.Configuration?.isResourceBrowser;
    // Check if this is a drawer item (special component) or regular resource
    const isDrawerItem = this.Data?.Configuration?.isDrawerItem;
    const drawerItemType = this.Data?.Configuration?.drawerItemType;

    console.log('PanelWrapper ngOnInit - isResourceBrowser:', isResourceBrowser);
    console.log('PanelWrapper ngOnInit - isDrawerItem:', isDrawerItem);
    console.log('PanelWrapper ngOnInit - drawerItemType:', drawerItemType);

    if (isResourceBrowser) {
      console.log('Loading browser component for resource type:', this.Data?.ResourceType);
      console.log('Configuration resourceTypeName:', this.Data?.Configuration?.resourceTypeName);
      // Load the appropriate browser component
      this.loadBrowserComponent();
    } else if (isDrawerItem && drawerItemType) {
      console.log('Loading special component for drawer item:', drawerItemType);
      // For drawer items, load the special component based on drawerItemType
      this.loadSpecialComponentByType(drawerItemType);
    } else if (this.Data?.ResourceType) {
      console.log('Checking ResourceType for special component:', this.Data.ResourceType);
      // For regular resources, check if it's a special type that needs a custom component
      this.checkForSpecialComponent();
    } else if (this.Data?.Configuration?.isApplicationView) {
      console.log('Found application view configuration');
      // For application views, load the SingleApplicationComponent
      this.loadApplicationView().catch(err => console.error('Error loading application view:', err));
    } else {
      console.log('Data not ready, retrying in 100ms');
      // Try again after a tick in case of timing issues
      setTimeout(() => {
        console.log('Retry - Data:', this.Data);
        console.log('Retry - Configuration:', this.Data?.Configuration);

        const isResourceBrowser = this.Data?.Configuration?.isResourceBrowser;
        const isDrawerItem = this.Data?.Configuration?.isDrawerItem;
        const drawerItemType = this.Data?.Configuration?.drawerItemType;

        if (isResourceBrowser) {
          console.log('Retry - Loading browser component for resource type:', this.Data?.ResourceType);
          console.log('Retry - Configuration resourceTypeName:', this.Data?.Configuration?.resourceTypeName);
          this.loadBrowserComponent();
        } else if (isDrawerItem && drawerItemType) {
          console.log('Retry - Loading special component for drawer item:', drawerItemType);
          this.loadSpecialComponentByType(drawerItemType);
        } else if (this.Data?.ResourceType) {
          console.log('Retry - Checking ResourceType for special component:', this.Data.ResourceType);
          this.checkForSpecialComponent();
        } else if (this.Data?.Configuration?.isApplicationView) {
          console.log('Retry - Found application view configuration');
          // For application views, load the SingleApplicationComponent
          this.loadApplicationView().catch(err => console.error('Error loading application view:', err));
        } else {
          console.log('Retry - Still no data, will use default resource component');
          // No special component needed, regular resource will be shown
          this.shouldShowSpecialComponent = false;
          // Trigger visibility to load the resource component
          setTimeout(() => {
            this.isVisible = true;
            this.cdr.detectChanges();
          }, 50);
        }
      }, 100);
    }
  }

  private loadBrowserComponent(): void {
    // Map resource types to their browser components
    const browserComponentMap: Record<string, Type<any>> = {
      'Dashboards': DashboardBrowserComponent,
      'Reports': ReportBrowserComponent,
      'Queries': QueryBrowserComponent
    };

    // Try to get resource type name from either computed property or configuration
    const resourceTypeName = this.Data?.ResourceType || this.Data?.Configuration?.resourceTypeName;
    console.log('loadBrowserComponent - resourceTypeName:', resourceTypeName);

    const componentType = browserComponentMap[resourceTypeName];

    if (componentType) {
      console.log('Loading browser component for:', resourceTypeName);
      this.shouldShowSpecialComponent = true;
      // Don't set contentLoading for browser components - they manage their own loading state
      this.contentLoading = false;

      // Create the browser component dynamically
      setTimeout(async () => {
        if (this.dynamicComponentContainer) {
          this.dynamicComponentContainer.clear();
          this.componentRef = this.dynamicComponentContainer.createComponent(componentType);

          // Initialize the component if it has an ngOnInit method
          if (this.componentRef.instance && typeof this.componentRef.instance.ngOnInit === 'function') {
            try {
              await this.componentRef.instance.ngOnInit();
            } catch (error) {
              console.error('Error initializing browser component:', error);
            }
          }

          this.cdr.detectChanges();
        }
      }, 0);
    } else {
      console.log('No browser component found for resource type:', resourceTypeName);
      console.log('Available browser components:', Object.keys(browserComponentMap));
      // Fall back to regular resource component
      this.shouldShowSpecialComponent = false;
      setTimeout(() => {
        this.isVisible = true;
        this.cdr.detectChanges();
      }, 50);
    }
  }

  private checkForSpecialComponent(): void {
    // Only certain resource types get special components
    // Most resource types should use the regular mj-resource component
    const specialComponentMap: Record<string, Type<any>> = {
      'Home': HomeWrapperComponent,
      'Settings': SettingsComponent,
      'AskSkip': SkipChatWrapperComponent,
      'Files': FilesComponent,
      'Lists': ListViewComponent,
      'Data': DataBrowserComponent
    };

    const componentType = specialComponentMap[this.Data!.ResourceType];

    if (componentType) {
      console.log('Found special component for ResourceType:', this.Data!.ResourceType);
      this.shouldShowSpecialComponent = true;

      // We'll create the component dynamically in the template's ViewContainerRef
      setTimeout(() => {
        if (this.dynamicComponentContainer) {
          this.dynamicComponentContainer.clear();
          this.componentRef = this.dynamicComponentContainer.createComponent(componentType);
          this.cdr.detectChanges();
        }
      }, 0);
    } else {
      console.log('No special component for ResourceType:', this.Data!.ResourceType, '- will use mj-resource');
      console.log('ResourceTypeID:', this.Data!.ResourceTypeID);
      console.log('Full Data object:', this.Data);
      // No special component, use regular mj-resource (for Dashboards, Reports, Queries, Views, etc.)
      this.shouldShowSpecialComponent = false;
      // Trigger visibility to load the resource component
      setTimeout(() => {
        console.log('Setting isVisible to true for resource component');
        this.isVisible = true;
        this.cdr.detectChanges();
      }, 50);
    }
  }

  private loadSpecialComponentByType(componentTypeName: string): void {
    const componentMap: Record<string, Type<any>> = {
      'Home': HomeWrapperComponent,
      'Settings': SettingsComponent,
      'AskSkip': SkipChatWrapperComponent,
      'Files': FilesComponent,
      'Lists': ListViewComponent,
      'Data': DataBrowserComponent
    };

    const componentType = componentMap[componentTypeName];

    if (componentType) {
      this.shouldShowSpecialComponent = true;

      // We'll create the component dynamically in the template's ViewContainerRef
      setTimeout(() => {
        if (this.dynamicComponentContainer) {
          this.dynamicComponentContainer.clear();
          this.componentRef = this.dynamicComponentContainer.createComponent(componentType);
          this.cdr.detectChanges();
        }
      }, 0);
    }
  }

  private async loadApplicationView(): Promise<void> {
    this.shouldShowSpecialComponent = true;

    // Load SingleApplicationComponent for application views
    setTimeout(async () => {
      if (this.dynamicComponentContainer) {
        this.dynamicComponentContainer.clear();
        this.componentRef = this.dynamicComponentContainer.createComponent(SingleApplicationComponent);

        // Pass the configuration to the component
        if (this.componentRef.instance && this.Data?.Configuration) {
          const instance = this.componentRef.instance as SingleApplicationComponent;

          console.log('Loading application view with appName:', this.Data.Configuration.appName);

          // Manually trigger the initialization since we're not using route params
          const md = new Metadata();
          instance.loading = true;

          // Check if metadata is loaded, if not, load it
          if (!md.Applications || md.Applications.length === 0) {
            console.log('Applications not loaded, loading metadata...');
            try {
              const dataset = await md.GetAndCacheDatasetByName('MJ_Metadata');
              if (dataset && dataset.Success) {
                console.log('Metadata loaded successfully');
              }
            } catch (error) {
              console.error('Error loading metadata:', error);
            }
          }

          // Find and set the application
          if (md.Applications && md.Applications.length > 0) {
            const app = md.Applications.find((a: ApplicationInfo) =>
              a.Name.toLowerCase() === this.Data!.Configuration.appName.toLowerCase()
            );

            if (app) {
              // Use the actual app name from metadata to ensure correct case
              instance.appName = app.Name;
              instance.app = app;
              instance.appDescription = app.Description || '';
              instance.appEntities = app.ApplicationEntities || [];
              console.log('Found application:', app.Name);
            } else {
              // If not found, still set the appName so it shows in error message
              instance.appName = this.Data.Configuration.appName;
              console.log('Application not found:', this.Data.Configuration.appName);
              console.log('Available applications:', md.Applications.map((a: ApplicationInfo) => a.Name));
            }
          } else {
            // Set appName even if no apps loaded
            instance.appName = this.Data.Configuration.appName;
            console.log('No applications loaded in metadata');
          }

          instance.loading = false;

          // If there's an entity name, we might need to handle that too
          if (this.Data.Configuration.entityName) {
            // The component will handle entity-specific logic
            (instance as any).entityName = this.Data.Configuration.entityName;
          }
        }

        this.cdr.detectChanges();
      }
    }, 0);
  }

  ngOnDestroy(): void {
    // Cleanup logic if needed
    if (this.componentRef) {
      this.componentRef.destroy();
    }
  }

  handleResourceRecordSaved(event: any): void {
    this.ResourceRecordSaved.emit(event);
  }

  handleContentLoadingStarted(): void {
    // Use setTimeout to avoid ExpressionChangedAfterItHasBeenCheckedError
    setTimeout(() => {
      this.contentLoading = true;
      this.ContentLoadingStarted.emit();
    }, 0);
  }

  handleContentLoadingComplete(): void {
    // Use setTimeout to avoid ExpressionChangedAfterItHasBeenCheckedError
    setTimeout(() => {
      this.contentLoading = false;
      this.ContentLoadingComplete.emit();
    }, 0);
  }
}