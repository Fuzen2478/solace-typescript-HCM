import { Client } from 'ldapts';
import winston from 'winston';

// Logger for LDAP service
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [LDAP] [${level.toUpperCase()}] ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'ldap.log' })
  ]
});

export interface LdapUser {
  id: string;
  name: string;
  email: string;
  department: string;
  title: string;
  manager?: string;
  location: string;
  skills: string[];
  phone?: string;
}

export interface LdapConfig {
  url: string;
  baseDN: string;
  bindDN: string;
  bindPassword: string;
  timeout?: number;
  connectTimeout?: number;
}

export class LdapService {
  private client: Client;
  private config: LdapConfig;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(config: Partial<LdapConfig> = {}) {
    this.config = {
      url: config.url || process.env.LDAP_URL || 'ldap://localhost:389',
      baseDN: config.baseDN || process.env.LDAP_BASE_DN || 'dc=company,dc=com',
      bindDN: config.bindDN || process.env.LDAP_BIND_DN || 'cn=admin,dc=company,dc=com',
      bindPassword: config.bindPassword || process.env.LDAP_BIND_PASSWORD || 'password',
      timeout: config.timeout || 5000,
      connectTimeout: config.connectTimeout || 10000
    };

    this.client = new Client({
      url: this.config.url,
      timeout: this.config.timeout,
      connectTimeout: this.config.connectTimeout,
      tlsOptions: {
        rejectUnauthorized: false // Development only
      }
    });

    logger.info(`LDAP Service initialized with URL: ${this.config.url}`);
  }

  async connect(): Promise<boolean> {
    if (this.isConnected) {
      return true;
    }

    try {
      await this.client.bind(this.config.bindDN, this.config.bindPassword);
      this.isConnected = true;
      this.reconnectAttempts = 0;
      logger.info('✅ LDAP connection established');
      return true;
    } catch (error) {
      this.isConnected = false;
      this.reconnectAttempts++;
      logger.error(`❌ LDAP connection failed (attempt ${this.reconnectAttempts}):`, error.message);
      
      // Automatic reconnection
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        logger.info(`🔄 Retrying LDAP connection in 5 seconds...`);
        setTimeout(() => this.connect(), 5000);
      }
      
      return false;
    }
  }

  async searchUsers(filter: string = '(objectClass=person)'): Promise<LdapUser[]> {
    if (!this.isConnected && !(await this.connect())) {
      logger.warn('⚠️ LDAP not connected, returning empty user list');
      return [];
    }

    try {
      const { searchEntries } = await this.client.search(
        `ou=people,${this.config.baseDN}`,
        {
          scope: 'sub',
          filter,
          attributes: [
            'uid', 'cn', 'mail', 'department', 'title',
            'manager', 'l', 'telephoneNumber', 'description'
          ]
        }
      );

      const users = searchEntries.map(entry => ({
        id: (entry.uid as string) || (entry.cn as string),
        name: entry.cn as string,
        email: entry.mail as string,
        department: (entry.department as string) || 'Unknown',
        title: (entry.title as string) || 'Employee',
        manager: entry.manager as string,
        location: (entry.l as string) || 'Seoul',
        phone: entry.telephoneNumber as string,
        skills: this.parseSkills(entry.description as string)
      }));

      logger.info(`📋 Found ${users.length} users with filter: ${filter}`);
      return users;
    } catch (error) {
      logger.error('❌ LDAP search failed:', error.message);
      this.isConnected = false;
      return [];
    }
  }

  async getUserByEmail(email: string): Promise<LdapUser | null> {
    const users = await this.searchUsers(`(mail=${email})`);
    return users.length > 0 ? users[0] : null;
  }

  async getUserById(id: string): Promise<LdapUser | null> {
    const users = await this.searchUsers(`(uid=${id})`);
    return users.length > 0 ? users[0] : null;
  }

  async getUsersByDepartment(department: string): Promise<LdapUser[]> {
    return this.searchUsers(`(department=${department})`);
  }

  async getUsersBySkill(skill: string): Promise<LdapUser[]> {
    return this.searchUsers(`(description=*${skill}*)`);
  }

  async authenticate(username: string, password: string): Promise<LdapUser | null> {
    const tempClient = new Client({
      url: this.config.url,
      tlsOptions: { rejectUnauthorized: false }
    });

    try {
      const userDN = `uid=${username},ou=people,${this.config.baseDN}`;
      await tempClient.bind(userDN, password);
      await tempClient.unbind();
      
      logger.info(`✅ Authentication successful for user: ${username}`);
      
      // Return user information after successful authentication
      return await this.getUserById(username);
    } catch (error) {
      logger.warn(`❌ Authentication failed for user: ${username}`);
      return null;
    }
  }

  async getOrganizationTree(): Promise<any[]> {
    if (!this.isConnected && !(await this.connect())) {
      return [];
    }

    try {
      const { searchEntries } = await this.client.search(
        `ou=groups,${this.config.baseDN}`,
        {
          scope: 'sub',
          filter: '(objectClass=organizationalUnit)',
          attributes: ['ou', 'description', 'member']
        }
      );

      const orgTree = searchEntries.map(entry => ({
        name: entry.ou,
        description: entry.description,
        members: Array.isArray(entry.member) ? entry.member : [entry.member].filter(Boolean)
      }));

      logger.info(`🏢 Retrieved organization tree with ${orgTree.length} units`);
      return orgTree;
    } catch (error) {
      logger.error('❌ Organization tree query failed:', error.message);
      return [];
    }
  }

  private parseSkills(description?: string): string[] {
    if (!description) return [];
    
    // Parse skills from description field
    // Expected format: "Skills: Node.js, React, SQL, ..."
    const skillMatch = description.match(/Skills:\s*([^.]+)/i);
    if (skillMatch) {
      return skillMatch[1]
        .split(',')
        .map(skill => skill.trim())
        .filter(skill => skill.length > 0);
    }
    
    return [];
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.searchUsers('(objectClass=person)');
      return true;
    } catch (error) {
      return false;
    }
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      try {
        await this.client.unbind();
        this.isConnected = false;
        logger.info('✅ LDAP disconnected');
      } catch (error) {
        logger.error('❌ LDAP disconnect error:', error);
      }
    }
  }
}

// Singleton instance
let ldapInstance: LdapService | null = null;

export function getLdapService(): LdapService {
  if (!ldapInstance) {
    ldapInstance = new LdapService();
  }
  return ldapInstance;
}
