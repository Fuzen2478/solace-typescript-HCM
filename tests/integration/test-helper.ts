import axios from 'axios';
import WebSocket from 'ws';

// ✅ Jest의 expect, test, describe, beforeAll 등은 전역으로 사용 가능하므로 import 불필요

// Test configuration
export const TEST_CONFIG = {
  services: {
    gateway: {
      url: 'http://localhost:3000',
      ws: 'ws://localhost:3006',
    },
    hr: {
      url: process.env.TEST_HR_URL || 'http://localhost:3001',
    },
    matching: {
      url: process.env.TEST_MATCHING_URL || 'http://localhost:3002',
    },
    edge: {
      url: process.env.TEST_EDGE_URL || 'http://localhost:3004',
    },
  },
  timeouts: {
    api: 10000,
    workflow: 30000,
    websocket: 5000,
  },
  retries: {
    healthCheck: 5,
    workflow: 3,
  },
};

// Test utilities
export class TestHelper {
  static async validateServiceHealth(): Promise<{ [key: string]: boolean }> {
    const healthStatus: { [key: string]: boolean } = {};

    for (const [serviceName, config] of Object.entries(TEST_CONFIG.services)) {
      try {
        const response = await axios.get(`${config.url}/health`, {
          timeout: TEST_CONFIG.timeouts.api,
        });
        healthStatus[serviceName] = response.status === 200;
      } catch (error) {
        healthStatus[serviceName] = false;
      }
    }

    return healthStatus;
  }
  static async waitForServices(
    services: string[] = ['gateway', 'hr', 'matching', 'edge'],
  ): Promise<void> {
    const maxRetries = TEST_CONFIG.retries.healthCheck;
    const delay = 2000;

    for (const service of services) {
      const serviceUrl =
        TEST_CONFIG.services[service as keyof typeof TEST_CONFIG.services].url;
      let retries = 0;
      let healthy = false;

      while (retries < maxRetries && !healthy) {
        try {
          const response = await axios.get(`${serviceUrl}/health`, {
            timeout: TEST_CONFIG.timeouts.api,
          });

          if (response.status === 200) {
            healthy = true;
            console.log(`✅ ${service} service is healthy`);
          }
        } catch {
          retries++;
          console.log(
            `⏳ Waiting for ${service} service... (${retries}/${maxRetries})`,
          );
          if (retries < maxRetries) {
            await this.sleep(delay);
          }
        }
      }

      if (!healthy) {
        throw new Error(
          `❌ ${service} service failed to become healthy after ${maxRetries} retries`,
        );
      }
    }
  }

  static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  static async createTestEmployee(employeeData?: Partial<any>): Promise<any> {
    const defaultEmployee = {
      name: `Test Employee ${Date.now()}`,
      email: `test${Date.now()}@company.com`,
      department: 'Engineering',
      location: 'Seoul',
      role: 'Software Engineer',
      skills: [
        { name: 'JavaScript', level: 'advanced', yearsOfExperience: 3 },
        { name: 'Python', level: 'intermediate', yearsOfExperience: 2 },
        { name: 'React', level: 'expert', yearsOfExperience: 4 },
      ],
      availability: {
        available: true,
        capacity: 80,
        scheduledHours: 20,
        maxHoursPerWeek: 40,
      },
      contactInfo: {
        phone: '+82-10-1234-5678',
        address: 'Seoul, South Korea',
      },
      emergencyContact: {
        name: 'Emergency Contact',
        relationship: 'Spouse',
        phone: '+82-10-8765-4321',
      },
    };

    const employee = { ...defaultEmployee, ...employeeData };
    const response = await axios.post(
      `${TEST_CONFIG.services.gateway.url}/api/hr/employees`,
      employee,
      { timeout: TEST_CONFIG.timeouts.api },
    );
    return response.data;
  }

  static async cleanupTestData(): Promise<void> {
    console.log('🧹 Cleaning up test data...');
    try {
      await axios
        .post(
          `${TEST_CONFIG.services.edge.url}/reset`,
          {},
          {
            timeout: TEST_CONFIG.timeouts.api,
          },
        )
        .catch(() => {});
    } catch (error: any) {
      console.warn('Cleanup warning:', error.message);
    }
  }

  static expectValidEmployee(employee: any): void {
    expect(employee).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      email: expect.any(String),
      department: expect.any(String),
      skills: expect.any(Array),
      availability: expect.any(Object),
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });

    expect(employee.skills.length).toBeGreaterThan(0);
    expect(employee.availability).toHaveProperty('available');
    expect(employee.availability).toHaveProperty('capacity');
  }
}

// Jest setup and teardown
export const setupIntegrationTests = () => {
  beforeAll(async () => {
    console.log('🚀 Setting up integration tests...');
    await TestHelper.waitForServices();
    console.log('✅ All services are ready');
  }, 60000);

  afterAll(async () => {
    console.log('🧹 Cleaning up after tests...');
    await TestHelper.cleanupTestData();
    console.log('✅ Cleanup completed');
  }, 30000);
};

export default TestHelper;
