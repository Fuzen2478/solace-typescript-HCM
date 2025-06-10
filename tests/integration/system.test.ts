import axios from 'axios';
import TestHelper, { setupIntegrationTests, TEST_CONFIG } from './test-helper';

describe('HCM System Integration Tests', () => {
  setupIntegrationTests();

  describe('Service Health and Connectivity', () => {
    test('should have all services healthy', async () => {
      const healthStatus = await TestHelper.validateServiceHealth();

      expect(healthStatus.gateway).toBe(true);
      expect(healthStatus.hr).toBe(true);
      expect(healthStatus.matching).toBe(true);
      expect(healthStatus.edge).toBe(true);
    });

    test('should access gateway service registry', async () => {
      const response = await axios.get(
        `${TEST_CONFIG.services.gateway.url}/services`,
        { timeout: TEST_CONFIG.timeouts.api },
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('services');
      expect(Array.isArray(response.data.services)).toBe(true);
      expect(response.data.services.length).toBeGreaterThanOrEqual(4);
    });

    test('should access gateway analytics overview', async () => {
      const response = await axios.get(
        `${TEST_CONFIG.services.gateway.url}/analytics/overview`,
        { timeout: TEST_CONFIG.timeouts.api },
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('services');
      expect(response.data.services).toHaveProperty('total');
      expect(response.data.services).toHaveProperty('healthy');
    });
  });

  describe('HR Resource Management', () => {
    let testEmployee: any;

    test('should create a new employee', async () => {
      testEmployee = await TestHelper.createTestEmployee({
        name: 'Integration Test Employee',
        email: `integration-test-${Date.now()}@company.com`,
      });

      TestHelper.expectValidEmployee(testEmployee);
      expect(testEmployee.name).toBe('Integration Test Employee');
    });

    test('should retrieve employee by ID', async () => {
      const response = await axios.get(
        `${TEST_CONFIG.services.gateway.url}/api/hr/employees/${testEmployee.id}`,
        { timeout: TEST_CONFIG.timeouts.api },
      );

      expect(response.status).toBe(200);
      TestHelper.expectValidEmployee(response.data);
      expect(response.data.id).toBe(testEmployee.id);
    });

    test('should update employee information', async () => {
      const updateData = {
        department: 'Data Science',
        role: 'Senior Data Scientist',
      };

      const response = await axios.put(
        `${TEST_CONFIG.services.gateway.url}/api/hr/employees/${testEmployee.id}`,
        updateData,
        { timeout: TEST_CONFIG.timeouts.api },
      );

      expect(response.status).toBe(200);
      expect(response.data.department).toBe('Data Science');
      expect(response.data.role).toBe('Senior Data Scientist');
    });

    test('should search employees by skills', async () => {
      const response = await axios.get(
        `${TEST_CONFIG.services.gateway.url}/api/hr/employees?skill=JavaScript`,
        { timeout: TEST_CONFIG.timeouts.api },
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('employees');
      expect(Array.isArray(response.data.employees)).toBe(true);

      if (response.data.employees.length > 0) {
        const employee = response.data.employees[0];
        TestHelper.expectValidEmployee(employee);
      }
    });

    test('should get organization hierarchy', async () => {
      const response = await axios.get(
        `${TEST_CONFIG.services.gateway.url}/api/hr/organization/hierarchy`,
        { timeout: TEST_CONFIG.timeouts.api },
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data)).toBe(true);
    });
  });
});
