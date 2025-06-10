import * as Automerge from '@automerge/automerge';
import { EventEmitter } from 'events';
import winston from 'winston';
import Redis from 'ioredis';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'crdt-manager.log' })
  ]
});

// CRDT Document Types
interface HRDocument {
  employees: Record<string, Employee>;
  departments: Record<string, Department>;
  assignments: Record<string, Assignment>;
  metadata: {
    lastSync: string;
    version: string;
    nodeId: string;
  };
}

interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  skills: string[];
  availability: 'available' | 'busy' | 'offline';
  lastUpdated: string;
}

interface Department {
  id: string;
  name: string;
  manager: string;
  employees: string[];
  budget: number;
}

interface Assignment {
  id: string;
  employeeId: string;
  taskType: string;
  priority: number;
  status: 'pending' | 'active' | 'completed' | 'failed';
  assignedAt: string;
  completedAt?: string;
}

// CRDT Document Manager
export class CRDTManager extends EventEmitter {
  private documents: Map<string, Automerge.Doc<any>> = new Map();
  private syncStates: Map<string, Automerge.SyncState> = new Map();
  private redis: Redis;
  private nodeId: string;
  private clusterName: string;

  constructor(redis: Redis, nodeId: string, clusterName: string) {
    super();
    this.redis = redis;
    this.nodeId = nodeId;
    this.clusterName = clusterName;
    
    this.setupRedisListeners();
  }

  // Initialize a new CRDT document
  public initializeDocument(docId: string, initialData?: any): void {
    if (this.documents.has(docId)) {
      logger.warn(`Document ${docId} already exists`);
      return;
    }

    let doc: Automerge.Doc<any>;
    
    if (initialData) {
      doc = Automerge.from(initialData);
    } else {
      // Create default HR document structure
      doc = Automerge.from<HRDocument>({
        employees: {},
        departments: {},
        assignments: {},
        metadata: {
          lastSync: new Date().toISOString(),
          version: '1.0.0',
          nodeId: this.nodeId
        }
      });
    }

    this.documents.set(docId, doc);
    this.syncStates.set(docId, Automerge.initSyncState());
    
    logger.info(`CRDT document initialized: ${docId}`);
    this.emit('documentInitialized', { docId, doc });
  }

  // Update document with atomic operations
  public updateDocument<T>(docId: string, updateFn: (doc: T) => void): boolean {
    const doc = this.documents.get(docId);
    if (!doc) {
      logger.error(`Document ${docId} not found`);
      return false;
    }

    try {
      const newDoc = Automerge.change(doc, (draft: T) => {
        updateFn(draft);
        
        // Update metadata
        if ('metadata' in draft) {
          (draft as any).metadata.lastSync = new Date().toISOString();
          (draft as any).metadata.nodeId = this.nodeId;
        }
      });

      this.documents.set(docId, newDoc);
      
      // Broadcast changes to cluster
      this.broadcastChanges(docId, newDoc);
      
      logger.info(`Document ${docId} updated successfully`);
      this.emit('documentUpdated', { docId, doc: newDoc });
      
      return true;
    } catch (error) {
      logger.error(`Error updating document ${docId}:`, error);
      return false;
    }
  }

  // Add employee to HR document
  public addEmployee(docId: string, employee: Employee): boolean {
    return this.updateDocument<HRDocument>(docId, (doc) => {
      doc.employees[employee.id] = employee;
    });
  }

  // Update employee availability
  public updateEmployeeAvailability(docId: string, employeeId: string, availability: 'available' | 'busy' | 'offline'): boolean {
    return this.updateDocument<HRDocument>(docId, (doc) => {
      if (doc.employees[employeeId]) {
        doc.employees[employeeId].availability = availability;
        doc.employees[employeeId].lastUpdated = new Date().toISOString();
      }
    });
  }

  // Assign task to employee
  public createAssignment(docId: string, assignment: Assignment): boolean {
    return this.updateDocument<HRDocument>(docId, (doc) => {
      doc.assignments[assignment.id] = assignment;
      
      // Update employee status
      if (doc.employees[assignment.employeeId]) {
        doc.employees[assignment.employeeId].availability = 'busy';
        doc.employees[assignment.employeeId].lastUpdated = new Date().toISOString();
      }
    });
  }

  // Complete assignment
  public completeAssignment(docId: string, assignmentId: string): boolean {
    return this.updateDocument<HRDocument>(docId, (doc) => {
      if (doc.assignments[assignmentId]) {
        doc.assignments[assignmentId].status = 'completed';
        doc.assignments[assignmentId].completedAt = new Date().toISOString();
        
        // Free up employee
        const employeeId = doc.assignments[assignmentId].employeeId;
        if (doc.employees[employeeId]) {
          doc.employees[employeeId].availability = 'available';
          doc.employees[employeeId].lastUpdated = new Date().toISOString();
        }
      }
    });
  }

  // Get document
  public getDocument(docId: string): any | null {
    return this.documents.get(docId) || null;
  }

  // Get specific data from document
  public getEmployees(docId: string): Record<string, Employee> {
    const doc = this.documents.get(docId);
    return doc ? (doc as HRDocument).employees : {};
  }

  public getAvailableEmployees(docId: string): Employee[] {
    const employees = this.getEmployees(docId);
    return Object.values(employees).filter(emp => emp.availability === 'available');
  }

  public getAssignments(docId: string, status?: string): Record<string, Assignment> {
    const doc = this.documents.get(docId);
    if (!doc) return {};
    
    const assignments = (doc as HRDocument).assignments;
    if (!status) return assignments;
    
    return Object.fromEntries(
      Object.entries(assignments).filter(([_, assignment]) => assignment.status === status)
    );
  }

  // Synchronization methods
  public async syncWithPeer(docId: string, peerId: string): Promise<boolean> {
    try {
      const doc = this.documents.get(docId);
      const syncState = this.syncStates.get(docId);
      
      if (!doc || !syncState) {
        logger.error(`Document or sync state not found for ${docId}`);
        return false;
      }

      // Get peer's document data from Redis
      const peerDocKey = `crdt:${this.clusterName}:${peerId}:${docId}`;
      const peerDocData = await this.redis.get(peerDocKey);
      
      if (!peerDocData) {
        logger.warn(`No peer document found for ${peerId}:${docId}`);
        return false;
      }

      const peerDoc = Automerge.load(Buffer.from(peerDocData, 'base64'));
      
      // Generate sync message
      const [nextSyncState, syncMessage] = Automerge.generateSyncMessage(doc, syncState);
      
      if (syncMessage) {
        // Apply peer changes
        const [updatedDoc, updatedSyncState] = Automerge.receiveSyncMessage(doc, syncState, syncMessage);
        
        this.documents.set(docId, updatedDoc);
        this.syncStates.set(docId, updatedSyncState);
        
        logger.info(`Synchronized document ${docId} with peer ${peerId}`);
        this.emit('documentSynced', { docId, peerId, doc: updatedDoc });
        
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error(`Error syncing with peer ${peerId}:`, error);
      return false;
    }
  }

  // Broadcast changes to cluster
  private async broadcastChanges(docId: string, doc: any): Promise<void> {
    try {
      const docData = Automerge.save(doc);
      const key = `crdt:${this.clusterName}:${this.nodeId}:${docId}`;
      
      // Store in Redis with expiry
      await this.redis.setex(key, 3600, Buffer.from(docData).toString('base64'));
      
      // Publish change notification
      await this.redis.publish(`crdt:${this.clusterName}:changes`, JSON.stringify({
        type: 'document_changed',
        nodeId: this.nodeId,
        docId,
        timestamp: new Date().toISOString()
      }));
      
    } catch (error) {
      logger.error('Error broadcasting changes:', error);
    }
  }

  // Setup Redis listeners for cluster synchronization
  private setupRedisListeners(): void {
    const subscriber = this.redis.duplicate();
    
    subscriber.subscribe(`crdt:${this.clusterName}:changes`);
    
    subscriber.on('message', async (channel, message) => {
      try {
        const data = JSON.parse(message);
        
        if (data.nodeId === this.nodeId) {
          return; // Ignore own changes
        }
        
        if (data.type === 'document_changed') {
          await this.handleRemoteDocumentChange(data);
        }
        
      } catch (error) {
        logger.error('Error handling Redis message:', error);
      }
    });
    
    logger.info(`CRDT Manager listening on cluster ${this.clusterName}`);
  }

  // Handle remote document changes
  private async handleRemoteDocumentChange(data: any): Promise<void> {
    const { nodeId, docId } = data;
    
    try {
      await this.syncWithPeer(docId, nodeId);
    } catch (error) {
      logger.error(`Error handling remote document change from ${nodeId}:`, error);
    }
  }

  // Merge conflict resolution
  public resolveConflicts(docId: string): any {
    const doc = this.documents.get(docId);
    if (!doc) return null;

    // Automerge handles most conflicts automatically
    // Custom conflict resolution logic can be added here
    
    return doc;
  }

  // Get synchronization status
  public getSyncStatus(docId: string): {
    docId: string;
    nodeId: string;
    lastSync: string | null;
    syncState: string;
    conflictCount: number;
  } {
    const doc = this.documents.get(docId);
    const syncState = this.syncStates.get(docId);
    
    return {
      docId,
      nodeId: this.nodeId,
      lastSync: doc ? (doc as any).metadata?.lastSync || null : null,
      syncState: syncState ? 'active' : 'inactive',
      conflictCount: 0 // Automerge resolves conflicts automatically
    };
  }

  // Cleanup
  public cleanup(): void {
    this.documents.clear();
    this.syncStates.clear();
    this.removeAllListeners();
    logger.info('CRDT Manager cleaned up');
  }
}

export { Employee, Department, Assignment, HRDocument };
