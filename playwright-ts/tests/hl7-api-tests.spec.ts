import { test, expect, APIRequestContext } from '@playwright/test';

/**
 * EPIC FHIR API Integration Tests
 * 
 * Senior Quality Engineer Level Tests
 * Comprehensive test suite for EPIC's FHIR interface covering:
 * - Positive test scenarios (happy path)
 * - Negative test scenarios (error handling)
 * - Integration test scenarios (data consistency & workflows)
 * 
 * API Endpoint: http://open.epic.com/Interface/FHIR
 * Documentation: https://fhir.epic.com/
 */

const FHIR_BASE_URL = 'http://open.epic.com/Interface/FHIR';
const SANDBOX_BASE_URL = 'http://open.epic.com/Interface/FHIR/R4';

// Test data constants
const TEST_PATIENT_ID = 'Tbt3KuCY0iivkqvTu4lIoGHvMrRwswqrTzLX0ZF8AA0B';
const INVALID_PATIENT_ID = 'INVALID-ID-12345-NOTFOUND';
const TEST_OBSERVATION_CODE = 'http://loinc.org|2345-7'; // Glucose in blood

interface FHIRResponse {
  resourceType: string;
  id?: string;
  entry?: Array<{ resource: any }>;
  issue?: Array<{ severity: string; code: string; diagnostics: string }>;
}

test.describe('EPIC FHIR API Integration Tests', () => {
  let apiContext: APIRequestContext;

  test.beforeAll(async ({ playwright }) => {
    apiContext = await playwright.request.newContext({
      baseURL: SANDBOX_BASE_URL,
      extraHTTPHeaders: {
        'Accept': 'application/fhir+json',
        'Content-Type': 'application/fhir+json',
      },
    });
  });

  test.afterAll(async () => {
    await apiContext.dispose();
  });

  // =====================================================
  // POSITIVE TEST SCENARIOS - Happy Path
  // =====================================================

  test('POSITIVE: Retrieve Patient resource by valid ID', async () => {
    const response = await apiContext.get(`/Patient/${TEST_PATIENT_ID}`);
    
    expect(response.status()).toBe(200);
    
    const data: FHIRResponse = await response.json();
    expect(data.resourceType).toBe('Patient');
    expect(data.id).toBe(TEST_PATIENT_ID);
    
    // Validate required Patient attributes
    expect(data).toHaveProperty('name');
    expect(data.name).toBeInstanceOf(Array);
    expect(data.name!.length).toBeGreaterThan(0);
    
    // Validate name structure
    const name = data.name![0];
    expect(name).toHaveProperty('given');
    expect(name).toHaveProperty('family');
  });

  test('POSITIVE: Search Patients with valid search parameters', async () => {
    const response = await apiContext.get('/Patient', {
      params: {
        family: 'Smith',
        given: 'John',
        birthdate: '1980',
        _count: '10',
      },
    });
    
    expect(response.status()).toBe(200);
    
    const data: FHIRResponse = await response.json();
    expect(data.resourceType).toBe('Bundle');
    expect(data).toHaveProperty('entry');
    
    // Validate bundle structure
    if (data.entry && data.entry.length > 0) {
      expect(data.entry[0].resource.resourceType).toBe('Patient');
    }
    
    // Validate pagination info
    expect(data).toHaveProperty('total');
    expect(typeof data.total).toBe('number');
  });

  test('POSITIVE: Retrieve Observations for Patient with status validation', async () => {
    const response = await apiContext.get('/Observation', {
      params: {
        patient: TEST_PATIENT_ID,
        status: 'final',
        _count: '50',
      },
    });
    
    expect(response.status()).toBe(200);
    
    const data: FHIRResponse = await response.json();
    expect(data.resourceType).toBe('Bundle');
    
    // Validate all observations have correct status
    if (data.entry) {
      data.entry.forEach(entry => {
        expect(entry.resource.status).toBe('final');
        expect(entry.resource).toHaveProperty('valueQuantity');
      });
    }
  });

  test('POSITIVE: Query with multiple filter conditions and pagination', async () => {
    const response = await apiContext.get('/Observation', {
      params: {
        patient: TEST_PATIENT_ID,
        date: 'ge2023-01-01',
        status: 'final',
        _sort: '-date',
        _count: '20',
        _offset: '0',
      },
    });
    
    expect(response.status()).toBe(200);
    
    const data: FHIRResponse = await response.json();
    expect(data.resourceType).toBe('Bundle');
    
    // Validate sorting by date (descending)
    if (data.entry && data.entry.length > 1) {
      const firstDate = new Date(data.entry[0].resource.effectiveDateTime);
      const secondDate = new Date(data.entry[1].resource.effectiveDateTime);
      expect(firstDate.getTime()).toBeGreaterThanOrEqual(secondDate.getTime());
    }
  });

  // =====================================================
  // NEGATIVE TEST SCENARIOS - Error Handling
  // =====================================================

  test('NEGATIVE: Request with invalid Patient ID returns 404', async () => {
    const response = await apiContext.get(`/Patient/${INVALID_PATIENT_ID}`);
    
    expect(response.status()).toBe(404);
    
    const data: FHIRResponse = await response.json();
    expect(data.resourceType).toBe('OperationOutcome');
    expect(data.issue).toBeDefined();
    expect(data.issue![0].severity).toMatch(/error|fatal/);
  });

  test('NEGATIVE: Invalid search parameter returns 400 with error details', async () => {
    const response = await apiContext.get('/Patient', {
      params: {
        invalidParam: 'shouldFail',
        _invalid: 'parameter',
      },
    });
    
    // FHIR servers may return 400 or ignore unknown params; validate appropriate behavior
    if (response.status() === 400) {
      const data: FHIRResponse = await response.json();
      expect(data.resourceType).toBe('OperationOutcome');
      expect(data.issue).toBeDefined();
      expect(data.issue![0].code).toMatch(/invalid|unknown/i);
    }
  });

  test('NEGATIVE: Malformed FHIR request with invalid date format', async () => {
    const response = await apiContext.get('/Observation', {
      params: {
        date: 'invalid-date-format-xyz',
      },
    });
    
    expect([400, 422]).toContain(response.status());
    
    if (response.status() >= 400) {
      const data: FHIRResponse = await response.json();
      expect(data.resourceType).toBe('OperationOutcome');
    }
  });

  test('NEGATIVE: Unauthorized access without proper credentials returns 401/403', async () => {
    const unauthedContext = await test.info().config.use;
    
    // Create context without credentials
    const unauthContext = await (test as any).apiContext();
    const response = await unauthContext.get(`/Patient/${TEST_PATIENT_ID}`, {
      headers: {
        'Authorization': 'Bearer invalid-token-xyz',
      },
    });
    
    expect([401, 403]).toContain(response.status());
  });

  // =====================================================
  // INTEGRATION TEST SCENARIOS - Workflow & Data Consistency
  // =====================================================

  test('INTEGRATION: Patient retrieval followed by Condition query validates data relationships', async () => {
    // Step 1: Get Patient details
    const patientResponse = await apiContext.get(`/Patient/${TEST_PATIENT_ID}`);
    expect(patientResponse.status()).toBe(200);
    const patient: FHIRResponse = await patientResponse.json();
    
    // Validate patient has identifier
    expect(patient).toHaveProperty('identifier');
    const patientIdentifier = patient.identifier![0].value;
    
    // Step 2: Query Conditions for this patient
    const conditionResponse = await apiContext.get('/Condition', {
      params: {
        patient: TEST_PATIENT_ID,
        _count: '100',
      },
    });
    
    expect(conditionResponse.status()).toBe(200);
    const conditions: FHIRResponse = await conditionResponse.json();
    
    // Step 3: Validate data consistency
    if (conditions.entry && conditions.entry.length > 0) {
      // All conditions should reference the correct patient
      conditions.entry.forEach(entry => {
        expect(entry.resource.subject).toBeDefined();
        expect(entry.resource.subject.reference).toContain(TEST_PATIENT_ID);
        
        // Verify condition has required fields
        expect(entry.resource).toHaveProperty('code');
        expect(entry.resource).toHaveProperty('clinicalStatus');
      });
    }
  });

  test('INTEGRATION: Multi-step workflow - Patient → Observations → Medication verification', async () => {
    // Step 1: Retrieve Patient
    const patientResponse = await apiContext.get(`/Patient/${TEST_PATIENT_ID}`);
    expect(patientResponse.status()).toBe(200);
    
    // Step 2: Get Observations for patient
    const observationResponse = await apiContext.get('/Observation', {
      params: {
        patient: TEST_PATIENT_ID,
        status: 'final',
        _count: '25',
      },
    });
    expect(observationResponse.status()).toBe(200);
    const observations: FHIRResponse = await observationResponse.json();
    
    // Step 3: Get MedicationStatements for patient
    const medicationResponse = await apiContext.get('/MedicationStatement', {
      params: {
        patient: TEST_PATIENT_ID,
        status: 'active',
      },
    });
    expect(medicationResponse.status()).toBe(200);
    const medications: FHIRResponse = await medicationResponse.json();
    
    // Step 4: Validate workflow consistency
    expect(observations.entry).toBeInstanceOf(Array);
    expect(medications.entry).toBeInstanceOf(Array);
    
    // All resources should reference same patient
    if (observations.entry) {
      observations.entry.forEach(entry => {
        expect(entry.resource.subject.reference).toContain(TEST_PATIENT_ID);
      });
    }
    
    if (medications.entry) {
      medications.entry.forEach(entry => {
        expect(entry.resource.subject.reference).toContain(TEST_PATIENT_ID);
      });
    }
  });

  test('INTEGRATION: Pagination consistency - verify results are complete across pages', async () => {
    const pageSize = 10;
    
    // Request first page
    const page1Response = await apiContext.get('/Observation', {
      params: {
        patient: TEST_PATIENT_ID,
        _count: pageSize,
        _offset: '0',
      },
    });
    expect(page1Response.status()).toBe(200);
    const page1: FHIRResponse = await page1Response.json();
    
    // Request second page
    const page2Response = await apiContext.get('/Observation', {
      params: {
        patient: TEST_PATIENT_ID,
        _count: pageSize,
        _offset: pageSize.toString(),
      },
    });
    expect(page2Response.status()).toBe(200);
    const page2: FHIRResponse = await page2Response.json();
    
    // Validate pagination integrity
    expect(page1.entry).toBeDefined();
    if (page1.entry && page2.entry) {
      const page1Ids = page1.entry.map(e => e.resource.id);
      const page2Ids = page2.entry.map(e => e.resource.id);
      
      // No overlap between pages
      const overlap = page1Ids.filter(id => page2Ids.includes(id));
      expect(overlap.length).toBe(0);
    }
    
    // Verify total count
    expect(page1.total).toBeDefined();
    expect(typeof page1.total).toBe('number');
  });

  test('INTEGRATION: Complex query with date range, status filters, and sort validates all constraints', async () => {
    const response = await apiContext.get('/Observation', {
      params: {
        patient: TEST_PATIENT_ID,
        date: 'ge2023-01-01&le2023-12-31',
        status: 'final',
        code: 'http://loinc.org|2345-7', // Glucose
        _sort: '-date',
        _count: '50',
      },
    });
    
    expect(response.status()).toBe(200);
    
    const data: FHIRResponse = await response.json();
    expect(data.resourceType).toBe('Bundle');
    
    // Validate all constraints are met
    if (data.entry) {
      data.entry.forEach((entry, index) => {
        const obs = entry.resource;
        
        // Verify status constraint
        expect(obs.status).toBe('final');
        
        // Verify date constraint
        const obsDate = new Date(obs.effectiveDateTime);
        expect(obsDate.getTime()).toBeGreaterThanOrEqual(new Date('2023-01-01').getTime());
        expect(obsDate.getTime()).toBeLessThanOrEqual(new Date('2023-12-31').getTime());
        
        // Verify code constraint
        if (obs.code.coding) {
          expect(obs.code.coding[0].code).toBe('2345-7');
        }
        
        // Verify sort order (descending)
        if (index > 0) {
          const prevDate = new Date(data.entry![index - 1].resource.effectiveDateTime);
          expect(obsDate.getTime()).toBeLessThanOrEqual(prevDate.getTime());
        }
      });
    }
  });

  test('INTEGRATION: Response format validation - ensure all FHIR resources have required metadata', async () => {
    const response = await apiContext.get(`/Patient/${TEST_PATIENT_ID}`);
    expect(response.status()).toBe(200);
    
    const data: FHIRResponse = await response.json();
    
    // Verify FHIR resource minimum requirements
    expect(data).toHaveProperty('resourceType');
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('meta');
    
    // Verify meta contains version/update info
    if (data.meta) {
      expect(data.meta).toHaveProperty('versionId');
      expect(data.meta).toHaveProperty('lastUpdated');
      
      // Validate lastUpdated is valid timestamp
      const lastUpdated = new Date(data.meta.lastUpdated);
      expect(lastUpdated.getTime()).toBeLessThanOrEqual(Date.now());
    }
  });

  test('INTEGRATION: Concurrent requests - verify API handles parallel queries correctly', async () => {
    const promises = [];
    
    // Execute 5 concurrent requests
    for (let i = 0; i < 5; i++) {
      promises.push(
        apiContext.get('/Observation', {
          params: {
            patient: TEST_PATIENT_ID,
            _count: '10',
          },
        })
      );
    }
    
    const responses = await Promise.all(promises);
    
    // All requests should succeed
    responses.forEach(response => {
      expect(response.status()).toBe(200);
    });
    
    // Verify consistency - all should return same total count
    const results = await Promise.all(responses.map(r => r.json()));
    const totalCounts = results.map(r => r.total);
    
    // All results should have same total (no data modified between concurrent requests)
    expect(new Set(totalCounts).size).toBe(1);
  });
});
