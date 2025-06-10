import * as Automerge from '@automerge/automerge';
import WebSocket from 'ws';
import { EventEmitter } from 'events';
import winston from 'winston';

// Enhanced CRDT Manager for distributed state synchronization
export class CRDTSyncManager extends EventEmitter {
  private documents: Map<string, any> = new Map();
  private connections: Map<string, WebSocket> = new Map();
  private syncHistory: Map<string, any[]> = new Map();
  private logger: winston.Logger;

  constructor() {
    super();
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'crdt-sync.log' })
      ]
    });
  }

  // Initialize a new CRDT document
  initializeDocument(documentId: string, initialData: any = {}) {
    const doc = Automerge.from(initialData);
    this.documents.set(documentId, doc);
    this.syncHistory.set(documentId, []);
    
    this.logger.info(`CRDT document initialized: ${documentId}`);
    this.emit('documentCreated', { documentId, data: initialData });
    
    return doc;
  }

  // Update a CRDT document
  updateDocument(documentId: string, updateFunction: (doc: any) => void) {
    const currentDoc = this.documents.get(documentId);
    if (!currentDoc) {
      throw new Error(`Document ${documentId} not found`);
    }

    const newDoc = Automerge.change(currentDoc, (doc: any) => {
      updateFunction(doc);
    });

    this.documents.set(documentId, newDoc);
    
    // Track changes for synchronization
    const changes = Automerge.getChanges(currentDoc, newDoc);
    this.syncHistory.get(documentId)?.push({
      timestamp: new Date(),
      changes: changes.length,
      changeData: changes
    });

    this.logger.info(`Document updated: ${documentId} (${changes.length} changes)`);
    
    // Broadcast changes to connected peers
    this.broadcastChanges(documentId, changes);
    
    this.emit('documentUpdated', { 
      documentId, 
      changes: changes.length,
      document: Automerge.save(newDoc)
    });

    return newDoc;
  }

  // Apply changes from remote peers
  applyRemoteChanges(documentId: string, changes: Uint8Array[]) {
    const currentDoc = this.documents.get(documentId);
    if (!currentDoc) {
      this.logger.warn(`Received changes for unknown document: ${documentId}`);
      return;
    }

    try {
      const [newDoc] = Automerge.applyChanges(currentDoc, changes);
      this.documents.set(documentId, newDoc);
      
      this.logger.info(`Applied ${changes.length} remote changes to document: ${documentId}`);
      
      this.emit('remoteChangesApplied', { 
        documentId, 
        changes: changes.length 
      });

      return newDoc;
    } catch (error) {
      this.logger.error(`Error applying remote changes to ${documentId}:`, error);
      throw error;
    }
  }

  // Connect to a remote peer
  connectToPeer(peerId: string, websocketUrl: string) {
    if (this.connections.has(peerId)) {
      this.logger.warn(`Already connected to peer: ${peerId}`);
      return;
    }

    const ws = new WebSocket(websocketUrl);
    
    ws.on('open', () => {
      this.connections.set(peerId, ws);
      this.logger.info(`Connected to peer: ${peerId}`);
      
      // Send initial sync request
      this.requestInitialSync(peerId);
      
      this.emit('peerConnected', { peerId });
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleIncomingMessage(peerId, message);
      } catch (error) {
        this.logger.error(`Error parsing message from peer ${peerId}:`, error);
      }
    });

    ws.on('close', () => {
      this.connections.delete(peerId);
      this.logger.info(`Disconnected from peer: ${peerId}`);
      this.emit('peerDisconnected', { peerId });
    });

    ws.on('error', (error) => {
      this.logger.error(`WebSocket error with peer ${peerId}:`, error);
      this.emit('peerError', { peerId, error });
    });
  }

  // Handle incoming messages from peers
  private handleIncomingMessage(peerId: string, message: any) {
    switch (message.type) {
      case 'sync_request':
        this.handleSyncRequest(peerId, message);
        break;
      case 'sync_response':
        this.handleSyncResponse(peerId, message);
        break;
      case 'changes':
        this.handleChangesMessage(peerId, message);
        break;
      case 'document_request':
        this.handleDocumentRequest(peerId, message);
        break;
      default:
        this.logger.warn(`Unknown message type from ${peerId}: ${message.type}`);
    }
  }

  // Request initial synchronization with a peer
  private requestInitialSync(peerId: string) {
    const ws = this.connections.get(peerId);
    if (!ws) return;

    const documentIds = Array.from(this.documents.keys());
    const syncMessage = {
      type: 'sync_request',
      documents: documentIds,
      timestamp: new Date().toISOString()
    };

    ws.send(JSON.stringify(syncMessage));
    this.logger.info(`Sent sync request to peer: ${peerId}`);
  }

  // Handle sync request from peer
  private handleSyncRequest(peerId: string, message: any) {
    const ws = this.connections.get(peerId);
    if (!ws) return;

    const documentStates: any = {};
    
    message.documents.forEach((docId: string) => {
      const doc = this.documents.get(docId);
      if (doc) {
        documentStates[docId] = {
          state: Automerge.save(doc),
          heads: Automerge.getHeads(doc)
        };
      }
    });

    const syncResponse = {
      type: 'sync_response',
      documents: documentStates,
      timestamp: new Date().toISOString()
    };

    ws.send(JSON.stringify(syncResponse));
    this.logger.info(`Sent sync response to peer: ${peerId}`);
  }

  // Handle sync response from peer
  private handleSyncResponse(peerId: string, message: any) {
    Object.entries(message.documents).forEach(([docId, docData]: [string, any]) => {
      const localDoc = this.documents.get(docId);
      
      if (!localDoc) {
        // Create new document from remote state
        const remoteDoc = Automerge.load(docData.state);
        this.documents.set(docId, remoteDoc);
        this.syncHistory.set(docId, []);
        
        this.logger.info(`Created new document from peer ${peerId}: ${docId}`);
        this.emit('documentSynced', { documentId: docId, source: peerId });
      } else {
        // Merge with existing document
        this.mergeDocuments(docId, docData.state, peerId);
      }
    });
  }

  // Handle changes message from peer
  private handleChangesMessage(peerId: string, message: any) {
    const { documentId, changes } = message;
    
    try {
      // Convert base64 changes back to Uint8Array
      const changeData = changes.map((change: string) => 
        new Uint8Array(Buffer.from(change, 'base64'))
      );
      
      this.applyRemoteChanges(documentId, changeData);
      
      // Send acknowledgment
      const ws = this.connections.get(peerId);
      if (ws) {
        ws.send(JSON.stringify({
          type: 'changes_ack',
          documentId,
          timestamp: new Date().toISOString()
        }));
      }
      
    } catch (error) {
      this.logger.error(`Error processing changes from peer ${peerId}:`, error);
    }
  }

  // Merge documents with conflict resolution
  private mergeDocuments(documentId: string, remoteState: Uint8Array, peerId: string) {
    const localDoc = this.documents.get(documentId);
    if (!localDoc) return;

    try {
      const remoteDoc = Automerge.load(remoteState);
      const mergedDoc = Automerge.merge(localDoc, remoteDoc);
      
      this.documents.set(documentId, mergedDoc);
      
      this.logger.info(`Merged document ${documentId} with changes from peer: ${peerId}`);
      this.emit('documentMerged', { 
        documentId, 
        source: peerId,
        conflicts: this.detectConflicts(localDoc, remoteDoc, mergedDoc)
      });
      
    } catch (error) {
      this.logger.error(`Error merging document ${documentId}:`, error);
    }
  }

  // Detect conflicts during merge
  private detectConflicts(localDoc: any, remoteDoc: any, mergedDoc: any): any[] {
    const conflicts: any[] = [];
    
    // This is a simplified conflict detection
    // In a real implementation, you'd want more sophisticated conflict detection
    try {
      const localState = JSON.stringify(Automerge.save(localDoc));
      const remoteState = JSON.stringify(Automerge.save(remoteDoc));
      const mergedState = JSON.stringify(Automerge.save(mergedDoc));
      
      if (localState !== mergedState && remoteState !== mergedState) {
        conflicts.push({
          type: 'merge_conflict',
          description: 'Automatic merge required conflict resolution',
          timestamp: new Date()
        });
      }
    } catch (error) {
      this.logger.warn('Error detecting conflicts:', error);
    }
    
    return conflicts;
  }

  // Broadcast changes to all connected peers
  private broadcastChanges(documentId: string, changes: Uint8Array[]) {
    if (changes.length === 0) return;

    const changeMessage = {
      type: 'changes',
      documentId,
      changes: changes.map(change => Buffer.from(change).toString('base64')),
      timestamp: new Date().toISOString()
    };

    const messageStr = JSON.stringify(changeMessage);
    
    this.connections.forEach((ws, peerId) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
        this.logger.debug(`Sent ${changes.length} changes for ${documentId} to peer: ${peerId}`);
      }
    });
  }

  // Get current document state
  getDocument(documentId: string) {
    const doc = this.documents.get(documentId);
    return doc ? Automerge.save(doc) : null;
  }

  // Get document as JSON
  getDocumentAsJSON(documentId: string) {
    const doc = this.documents.get(documentId);
    return doc ? JSON.parse(JSON.stringify(doc)) : null;
  }

  // Get sync statistics
  getSyncStats() {
    const stats = {
      documents: this.documents.size,
      connectedPeers: this.connections.size,
      totalSyncEvents: 0,
      documentStats: {} as any
    };

    this.syncHistory.forEach((history, docId) => {
      stats.totalSyncEvents += history.length;
      stats.documentStats[docId] = {
        syncEvents: history.length,
        lastSync: history.length > 0 ? history[history.length - 1].timestamp : null
      };
    });

    return stats;
  }

  // Clean up resources
  disconnect() {
    this.connections.forEach((ws, peerId) => {
      ws.close();
      this.logger.info(`Disconnected from peer: ${peerId}`);
    });
    
    this.connections.clear();
    this.emit('allPeersDisconnected');
  }

  // Create a snapshot of all documents
  createSnapshot() {
    const snapshot: any = {};
    
    this.documents.forEach((doc, docId) => {
      snapshot[docId] = {
        state: Automerge.save(doc),
        data: JSON.parse(JSON.stringify(doc)),
        heads: Automerge.getHeads(doc),
        history: this.syncHistory.get(docId) || []
      };
    });

    return {
      timestamp: new Date(),
      documents: snapshot,
      stats: this.getSyncStats()
    };
  }

  // Restore from snapshot
  restoreFromSnapshot(snapshot: any) {
    this.documents.clear();
    this.syncHistory.clear();

    Object.entries(snapshot.documents).forEach(([docId, docData]: [string, any]) => {
      const doc = Automerge.load(docData.state);
      this.documents.set(docId, doc);
      this.syncHistory.set(docId, docData.history || []);
    });

    this.logger.info(`Restored ${Object.keys(snapshot.documents).length} documents from snapshot`);
    this.emit('snapshotRestored', { 
      documents: Object.keys(snapshot.documents).length,
      timestamp: snapshot.timestamp 
    });
  }
}

// Employee Resource Pool CRDT Document
export interface EmployeeResourcePool {
  employees: { [id: string]: any };
  assignments: { [taskId: string]: string[] }; // taskId -> employeeIds
  availability: { [employeeId: string]: any };
  lastUpdated: string;
}

// Task Queue CRDT Document
export interface TaskQueue {
  tasks: { [id: string]: any };
  queue: string[]; // taskIds in priority order
  processing: { [agentId: string]: string[] }; // agentId -> taskIds
  completed: string[];
  failed: string[];
  lastUpdated: string;
}

// HCM Distributed State Manager
export class HCMDistributedState {
  private crdtManager: CRDTSyncManager;
  private logger: winston.Logger;

  constructor() {
    this.crdtManager = new CRDTSyncManager();
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'hcm-distributed-state.log' })
      ]
    });

    this.initializeDocuments();
    this.setupEventHandlers();
  }

  private initializeDocuments() {
    // Initialize Employee Resource Pool
    this.crdtManager.initializeDocument('employee-pool', {
      employees: {},
      assignments: {},
      availability: {},
      lastUpdated: new Date().toISOString()
    });

    // Initialize Task Queue
    this.crdtManager.initializeDocument('task-queue', {
      tasks: {},
      queue: [],
      processing: {},
      completed: [],
      failed: [],
      lastUpdated: new Date().toISOString()
    });

    // Initialize System State
    this.crdtManager.initializeDocument('system-state', {
      agents: {},
      services: {},
      metrics: {},
      lastUpdated: new Date().toISOString()
    });
  }

  private setupEventHandlers() {
    this.crdtManager.on('documentUpdated', (event) => {
      this.logger.info(`Document synchronized: ${event.documentId}`);
    });

    this.crdtManager.on('documentMerged', (event) => {
      this.logger.info(`Document merged with conflicts: ${event.documentId}`, event.conflicts);
    });

    this.crdtManager.on('peerConnected', (event) => {
      this.logger.info(`Peer connected: ${event.peerId}`);
    });
  }

  // Employee Resource Pool Operations
  addEmployee(employee: any) {
    return this.crdtManager.updateDocument('employee-pool', (doc: EmployeeResourcePool) => {
      doc.employees[employee.id] = employee;
      doc.availability[employee.id] = {
        available: true,
        capacity: 100,
        workload: 0,
        lastUpdated: new Date().toISOString()
      };
      doc.lastUpdated = new Date().toISOString();
    });
  }

  updateEmployeeAvailability(employeeId: string, availability: any) {
    return this.crdtManager.updateDocument('employee-pool', (doc: EmployeeResourcePool) => {
      if (doc.availability[employeeId]) {
        Object.assign(doc.availability[employeeId], availability);
        doc.availability[employeeId].lastUpdated = new Date().toISOString();
        doc.lastUpdated = new Date().toISOString();
      }
    });
  }

  assignEmployeeToTask(taskId: string, employeeId: string) {
    return this.crdtManager.updateDocument('employee-pool', (doc: EmployeeResourcePool) => {
      if (!doc.assignments[taskId]) {
        doc.assignments[taskId] = [];
      }
      if (!doc.assignments[taskId].includes(employeeId)) {
        doc.assignments[taskId].push(employeeId);
        doc.lastUpdated = new Date().toISOString();
      }
    });
  }

  // Task Queue Operations
  addTask(task: any) {
    return this.crdtManager.updateDocument('task-queue', (doc: TaskQueue) => {
      doc.tasks[task.id] = task;
      // Insert task in priority order
      const insertIndex = this.findInsertIndex(doc.queue, task, doc.tasks);
      doc.queue.splice(insertIndex, 0, task.id);
      doc.lastUpdated = new Date().toISOString();
    });
  }

  private findInsertIndex(queue: string[], newTask: any, allTasks: any): number {
    const priorityOrder = { 'urgent': 0, 'high': 1, 'medium': 2, 'low': 3 };
    const newTaskPriority = priorityOrder[newTask.priority] || 2;
    
    for (let i = 0; i < queue.length; i++) {
      const existingTask = allTasks[queue[i]];
      const existingPriority = priorityOrder[existingTask?.priority] || 2;
      
      if (newTaskPriority < existingPriority) {
        return i;
      }
    }
    
    return queue.length;
  }

  assignTaskToAgent(taskId: string, agentId: string) {
    return this.crdtManager.updateDocument('task-queue', (doc: TaskQueue) => {
      // Remove from queue
      const queueIndex = doc.queue.indexOf(taskId);
      if (queueIndex > -1) {
        doc.queue.splice(queueIndex, 1);
      }
      
      // Add to processing
      if (!doc.processing[agentId]) {
        doc.processing[agentId] = [];
      }
      if (!doc.processing[agentId].includes(taskId)) {
        doc.processing[agentId].push(taskId);
      }
      
      doc.lastUpdated = new Date().toISOString();
    });
  }

  completeTask(taskId: string, agentId: string) {
    return this.crdtManager.updateDocument('task-queue', (doc: TaskQueue) => {
      // Remove from processing
      if (doc.processing[agentId]) {
        const index = doc.processing[agentId].indexOf(taskId);
        if (index > -1) {
          doc.processing[agentId].splice(index, 1);
        }
      }
      
      // Add to completed
      if (!doc.completed.includes(taskId)) {
        doc.completed.push(taskId);
      }
      
      doc.lastUpdated = new Date().toISOString();
    });
  }

  failTask(taskId: string, agentId: string) {
    return this.crdtManager.updateDocument('task-queue', (doc: TaskQueue) => {
      // Remove from processing
      if (doc.processing[agentId]) {
        const index = doc.processing[agentId].indexOf(taskId);
        if (index > -1) {
          doc.processing[agentId].splice(index, 1);
        }
      }
      
      // Add to failed
      if (!doc.failed.includes(taskId)) {
        doc.failed.push(taskId);
      }
      
      doc.lastUpdated = new Date().toISOString();
    });
  }

  // System State Operations
  updateAgentStatus(agentId: string, status: any) {
    return this.crdtManager.updateDocument('system-state', (doc: any) => {
      doc.agents[agentId] = {
        ...status,
        lastUpdated: new Date().toISOString()
      };
      doc.lastUpdated = new Date().toISOString();
    });
  }

  updateServiceMetrics(serviceId: string, metrics: any) {
    return this.crdtManager.updateDocument('system-state', (doc: any) => {
      doc.services[serviceId] = {
        ...metrics,
        lastUpdated: new Date().toISOString()
      };
      doc.lastUpdated = new Date().toISOString();
    });
  }

  // Query Operations
  getAvailableEmployees(): any[] {
    const employeePool = this.crdtManager.getDocumentAsJSON('employee-pool') as EmployeeResourcePool;
    if (!employeePool) return [];

    return Object.values(employeePool.employees).filter((emp: any) => {
      const availability = employeePool.availability[emp.id];
      return availability && availability.available && availability.capacity > 20;
    });
  }

  getPendingTasks(): any[] {
    const taskQueue = this.crdtManager.getDocumentAsJSON('task-queue') as TaskQueue;
    if (!taskQueue) return [];

    return taskQueue.queue.map(taskId => taskQueue.tasks[taskId]).filter(Boolean);
  }

  getActiveAgents(): any[] {
    const systemState = this.crdtManager.getDocumentAsJSON('system-state');
    if (!systemState) return [];

    return Object.values(systemState.agents).filter((agent: any) => {
      const heartbeatAge = Date.now() - new Date(agent.lastUpdated).getTime();
      return agent.status === 'active' && heartbeatAge < 60000; // Active within last minute
    });
  }

  // Connection Management
  connectToPeer(peerId: string, websocketUrl: string) {
    return this.crdtManager.connectToPeer(peerId, websocketUrl);
  }

  // Statistics and Monitoring
  getDistributedStats() {
    return {
      sync: this.crdtManager.getSyncStats(),
      employees: this.getAvailableEmployees().length,
      pendingTasks: this.getPendingTasks().length,
      activeAgents: this.getActiveAgents().length,
      timestamp: new Date()
    };
  }

  // Backup and Recovery
  createBackup() {
    return this.crdtManager.createSnapshot();
  }

  restoreFromBackup(backup: any) {
    return this.crdtManager.restoreFromSnapshot(backup);
  }

  // Cleanup
  disconnect() {
    this.crdtManager.disconnect();
  }
}

export default HCMDistributedState;