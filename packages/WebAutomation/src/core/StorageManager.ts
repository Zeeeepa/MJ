import * as fs from 'fs/promises';
import * as path from 'path';
import { Service, Flow } from '../types';

export class StorageManager {
  private dataDir: string;
  
  constructor(dataDir: string = './data') {
    this.dataDir = dataDir;
  }
  
  async initialize(): Promise<void> {
    // Create data directories
    await fs.mkdir(path.join(this.dataDir, 'flows'), { recursive: true });
    await fs.mkdir(path.join(this.dataDir, 'cookies'), { recursive: true });
    await fs.mkdir(path.join(this.dataDir, 'screenshots'), { recursive: true });
    await fs.mkdir(path.join(this.dataDir, 'services'), { recursive: true });
  }
  
  // Service management
  async saveService(service: Service): Promise<void> {
    const filePath = path.join(this.dataDir, 'services', `${service.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(service, null, 2));
  }
  
  async loadService(serviceId: string): Promise<Service | null> {
    try {
      const filePath = path.join(this.dataDir, 'services', `${serviceId}.json`);
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }
  
  async listServices(): Promise<Service[]> {
    try {
      const servicesDir = path.join(this.dataDir, 'services');
      const files = await fs.readdir(servicesDir);
      const services: Service[] = [];
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readFile(path.join(servicesDir, file), 'utf-8');
          services.push(JSON.parse(data));
        }
      }
      
      return services;
    } catch (error) {
      return [];
    }
  }
  
  // Flow management
  async saveFlow(flow: Flow): Promise<void> {
    const filePath = path.join(this.dataDir, 'flows', `${flow.serviceId}_${flow.name}.json`);
    await fs.writeFile(filePath, JSON.stringify(flow, null, 2));
  }
  
  async loadFlow(serviceId: string, flowName: string): Promise<Flow | null> {
    try {
      const filePath = path.join(this.dataDir, 'flows', `${serviceId}_${flowName}.json`);
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }
  
  async loadFlowsForService(serviceId: string): Promise<Flow[]> {
    try {
      const flowsDir = path.join(this.dataDir, 'flows');
      const files = await fs.readdir(flowsDir);
      const flows: Flow[] = [];
      
      for (const file of files) {
        if (file.startsWith(`${serviceId}_`) && file.endsWith('.json')) {
          const data = await fs.readFile(path.join(flowsDir, file), 'utf-8');
          flows.push(JSON.parse(data));
        }
      }
      
      return flows;
    } catch (error) {
      return [];
    }
  }
  
  // Cookie management
  async saveCookies(serviceId: string, cookies: any[]): Promise<void> {
    const filePath = path.join(this.dataDir, 'cookies', `${serviceId}.json`);
    await fs.writeFile(filePath, JSON.stringify(cookies, null, 2));
  }
  
  async loadCookies(serviceId: string): Promise<any[] | null> {
    try {
      const filePath = path.join(this.dataDir, 'cookies', `${serviceId}.json`);
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }
  
  // Screenshot management
  getScreenshotPath(serviceId: string, timestamp: number): string {
    return path.join(this.dataDir, 'screenshots', `${serviceId}_${timestamp}.png`);
  }
}

