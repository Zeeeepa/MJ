/**
 * FlowStorage - Store and retrieve authentication flows
 */
import { promises as fs } from 'fs';
import { join } from 'path';

export interface Flow {
  id: string;
  serviceId: string;
  type: 'authentication' | 'chat' | 'extraction';
  name: string;
  steps: FlowStep[];
  validated: boolean;
  lastValidated?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface FlowStep {
  id: string;
  type: 'navigate' | 'click' | 'type' | 'wait' | 'extract';
  selector: string;
  value?: string;
  timeout?: number;
  expectedResult?: string;
}

export interface ServiceSession {
  serviceId: string;
  cookies: any[];
  authenticated: boolean;
  lastUsed: Date;
  expiresAt?: Date;
}

export class FlowStorage {
  private dataDir: string;
  private flows: Map<string, Flow> = new Map();
  private sessions: Map<string, ServiceSession> = new Map();

  constructor(dataDir: string = './data') {
    this.dataDir = dataDir;
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true });
    await fs.mkdir(join(this.dataDir, 'flows'), { recursive: true });
    await fs.mkdir(join(this.dataDir, 'sessions'), { recursive: true });
    await this.loadFlows();
    await this.loadSessions();
  }

  async saveFlow(flow: Flow): Promise<void> {
    flow.updatedAt = new Date();
    this.flows.set(flow.id, flow);
    const filePath = join(this.dataDir, 'flows', `${flow.serviceId}-${flow.type}.json`);
    await fs.writeFile(filePath, JSON.stringify(flow, null, 2));
  }

  async getFlow(serviceId: string, type: Flow['type']): Promise<Flow | null> {
    for (const [_, flow] of this.flows) {
      if (flow.serviceId === serviceId && flow.type === type) {
        return flow;
      }
    }
    return null;
  }

  async getServiceFlows(serviceId: string): Promise<Flow[]> {
    const flows: Flow[] = [];
    for (const [_, flow] of this.flows) {
      if (flow.serviceId === serviceId) flows.push(flow);
    }
    return flows;
  }

  async saveSession(session: ServiceSession): Promise<void> {
    session.lastUsed = new Date();
    this.sessions.set(session.serviceId, session);
    const filePath = join(this.dataDir, 'sessions', `${session.serviceId}.json`);
    await fs.writeFile(filePath, JSON.stringify(session, null, 2));
  }

  async getSession(serviceId: string): Promise<ServiceSession | null> {
    const session = this.sessions.get(serviceId);
    if (!session) return null;
    if (session.expiresAt && new Date() > session.expiresAt) {
      await this.deleteSession(serviceId);
      return null;
    }
    return session;
  }

  async deleteSession(serviceId: string): Promise<void> {
    this.sessions.delete(serviceId);
    const filePath = join(this.dataDir, 'sessions', `${serviceId}.json`);
    try { await fs.unlink(filePath); } catch {}
  }

  private async loadFlows(): Promise<void> {
    try {
      const flowsDir = join(this.dataDir, 'flows');
      const files = await fs.readdir(flowsDir);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const content = await fs.readFile(join(flowsDir, file), 'utf-8');
        const flow: Flow = JSON.parse(content);
        flow.createdAt = new Date(flow.createdAt);
        flow.updatedAt = new Date(flow.updatedAt);
        if (flow.lastValidated) flow.lastValidated = new Date(flow.lastValidated);
        this.flows.set(flow.id, flow);
      }
    } catch {}
  }

  private async loadSessions(): Promise<void> {
    try {
      const sessionsDir = join(this.dataDir, 'sessions');
      const files = await fs.readdir(sessionsDir);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const content = await fs.readFile(join(sessionsDir, file), 'utf-8');
        const session: ServiceSession = JSON.parse(content);
        session.lastUsed = new Date(session.lastUsed);
        if (session.expiresAt) session.expiresAt = new Date(session.expiresAt);
        if (session.expiresAt && new Date() > session.expiresAt) continue;
        this.sessions.set(session.serviceId, session);
      }
    } catch {}
  }

  async markFlowValidated(flowId: string): Promise<void> {
    const flow = this.flows.get(flowId);
    if (!flow) return;
    flow.validated = true;
    flow.lastValidated = new Date();
    await this.saveFlow(flow);
  }

  getAllFlows(): Flow[] {
    return Array.from(this.flows.values());
  }

  getAllSessions(): ServiceSession[] {
    return Array.from(this.sessions.values());
  }
}
