import { test, expect, APIRequestContext } from '@playwright/test';

// API Configuration
const API_BASE_URL = 'https://restful-booker.herokuapp.com';
const API_TIMEOUT = 10000;

// Test data interfaces
interface BookingData {
  firstname: string;
  lastname: string;
  totalprice: number;
  depositpaid: boolean;
  bookingdates: {
    checkin: string;
    checkout: string;
  };
  additionalneeds?: string;
}

interface AuthTokenResponse {
  token: string;
}

interface BookingResponse extends BookingData {
  bookingid: number;
}

// Test fixtures and setup
test.describe('RESTful Booker API - Comprehensive Test Suite', () => {
  let authToken: string;
  let createdBookingIds: number[] = [];

  // Helper function to create valid booking data
  const createValidBookingData = (overrides?: Partial<BookingData>): BookingData => {
    return {
      firstname: 'John',
      lastname: 'Doe',
      totalprice: 250,
      depositpaid: true,
      bookingdates: {
        checkin: '2025-06-01',
        checkout: '2025-06-05',
      },
      additionalneeds: 'Late checkout',
      ...overrides,
    };
  };

  // Clean up - Delete all created bookings
  test.afterAll(async ({ request }) => {
    for (const bookingId of createdBookingIds) {
      try {
        await request.delete(`${API_BASE_URL}/booking/${bookingId}`, {
          headers: {
            Cookie: `token=${authToken}`,
          },
        });
      } catch (error) {
        console.log(`Failed to delete booking ${bookingId}:`, error);
      }
    }
  });

  // ==================== HEALTH & AUTHENTICATION ====================
  test.describe('Health Check & Authentication', () => {
    test('should respond with 201 from health check endpoint', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/ping`);

      expect(response.status()).toBe(201);
    });

    test('should successfully authenticate with valid credentials', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth`, {
        data: {
          username: 'admin',
          password: 'password123',
        },
      });

      expect(response.status()).toBe(200);
      const body = await response.json() as AuthTokenResponse;
      expect(body).toHaveProperty('token');
      expect(typeof body.token).toBe('string');
      expect(body.token.length).toBeGreaterThan(0);

      authToken = body.token;
    });

    test('should return 200 with object containing token property on successful auth', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth`, {
        data: {
          username: 'admin',
          password: 'password123',
        },
      });

      const body = await response.json() as AuthTokenResponse;
      expect(body).toEqual(
        expect.objectContaining({
          token: expect.any(String),
        })
      );
    });

    test('should fail authentication with invalid credentials', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth`, {
        data: {
          username: 'invalid',
          password: 'wrongpassword',
        },
      });

      expect(response.status()).toBe(200);
      const body = await response.json() as { reason?: string };
      // API returns 200 with reason field for invalid auth
      expect(body).toHaveProperty('reason');
    });
  });

  // ==================== BOOKING CREATION ====================
  test.describe('Booking Creation (POST /booking)', () => {
    test('should create a booking with valid data', async ({ request }) => {
      const bookingData = createValidBookingData();

      const response = await request.post(`${API_BASE_URL}/booking`, {
        data: bookingData,
      });

      expect(response.status()).toBe(200);
      const body = await response.json() as { bookingid: number; booking: BookingData };
      expect(body).toHaveProperty('bookingid');
      expect(typeof body.bookingid).toBe('number');
      expect(body.bookingid).toBeGreaterThan(0);
      expect(body.booking).toEqual(
        expect.objectContaining({
          firstname: bookingData.firstname,
          lastname: bookingData.lastname,
          totalprice: bookingData.totalprice,
          depositpaid: bookingData.depositpaid,
        })
      );

      createdBookingIds.push(body.bookingid);
    });

    test('should create multiple bookings with different data', async ({ request }) => {
      const testCases = [
        createValidBookingData({ firstname: 'Alice', totalprice: 100 }),
        createValidBookingData({ firstname: 'Bob', totalprice: 500, depositpaid: false }),
        createValidBookingData({ firstname: 'Charlie', additionalneeds: 'Baby cot' }),
      ];

      for (const bookingData of testCases) {
        const response = await request.post(`${API_BASE_URL}/booking`, {
          data: bookingData,
        });

        expect(response.status()).toBe(200);
        const body = await response.json() as { bookingid: number };
        expect(body.bookingid).toBeGreaterThan(0);
        createdBookingIds.push(body.bookingid);
      }
    });

    test('should create booking with zero price', async ({ request }) => {
      const bookingData = createValidBookingData({ totalprice: 0 });

      const response = await request.post(`${API_BASE_URL}/booking`, {
        data: bookingData,
      });

      expect(response.status()).toBe(200);
      const body = await response.json() as { bookingid: number };
      createdBookingIds.push(body.bookingid);
    });

    test('should create booking with large price amount', async ({ request }) => {
      const bookingData = createValidBookingData({ totalprice: 999999 });

      const response = await request.post(`${API_BASE_URL}/booking`, {
        data: bookingData,
      });

      expect(response.status()).toBe(200);
      const body = await response.json() as { bookingid: number };
      createdBookingIds.push(body.bookingid);
    });

    test('should create booking with additional needs', async ({ request }) => {
      const bookingData = createValidBookingData({
        additionalneeds: 'Late checkout, early check-in, crib needed',
      });

      const response = await request.post(`${API_BASE_URL}/booking`, {
        data: bookingData,
      });

      expect(response.status()).toBe(200);
      const body = await response.json() as { bookingid: number; booking: BookingData };
      expect(body.booking.additionalneeds).toBe(bookingData.additionalneeds);
      createdBookingIds.push(body.bookingid);
    });

    test('should return 400 when missing required firstname field', async ({ request }) => {
      const bookingData = createValidBookingData();
      const { firstname, ...dataWithoutFirstname } = bookingData;

      const response = await request.post(`${API_BASE_URL}/booking`, {
        data: dataWithoutFirstname,
      });

      expect(response.status()).toBe(400);
    });

    test('should return 400 when missing required lastname field', async ({ request }) => {
      const bookingData = createValidBookingData();
      const { lastname, ...dataWithoutLastname } = bookingData;

      const response = await request.post(`${API_BASE_URL}/booking`, {
        data: dataWithoutLastname,
      });

      expect(response.status()).toBe(400);
    });

    test('should return 400 when missing bookingdates', async ({ request }) => {
      const bookingData = createValidBookingData();
      const { bookingdates, ...dataWithoutDates } = bookingData;

      const response = await request.post(`${API_BASE_URL}/booking`, {
        data: dataWithoutDates,
      });

      expect(response.status()).toBe(400);
    });

    test('should handle special characters in name fields', async ({ request }) => {
      const bookingData = createValidBookingData({
        firstname: "O'Brien",
        lastname: "Müller-José",
      });

      const response = await request.post(`${API_BASE_URL}/booking`, {
        data: bookingData,
      });

      expect(response.status()).toBe(200);
      const body = await response.json() as { bookingid: number; booking: BookingData };
      expect(body.booking.firstname).toBe("O'Brien");
      createdBookingIds.push(body.bookingid);
    });
  });

  // ==================== BOOKING RETRIEVAL ====================
  test.describe('Booking Retrieval (GET /booking)', () => {
    let testBookingId: number;

    test.beforeAll(async ({ request }) => {
      // Create a booking for retrieval tests
      const bookingData = createValidBookingData({ firstname: 'TestUser' });
      const response = await request.post(`${API_BASE_URL}/booking`, {
        data: bookingData,
      });
      const body = await response.json() as { bookingid: number };
      testBookingId = body.bookingid;
      createdBookingIds.push(testBookingId);
    });

    test('should retrieve all bookings', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/booking`);

      expect(response.status()).toBe(200);
      const body = await response.json() as Array<{ bookingid: number }>;
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThan(0);
    });

    test('should filter bookings by firstname', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/booking`, {
        params: {
          firstname: 'TestUser',
        },
      });

      expect(response.status()).toBe(200);
      const body = await response.json() as Array<{ bookingid: number }>;
      expect(Array.isArray(body)).toBe(true);
    });

    test('should filter bookings by lastname', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/booking`, {
        params: {
          lastname: 'Doe',
        },
      });

      expect(response.status()).toBe(200);
      const body = await response.json() as Array<{ bookingid: number }>;
      expect(Array.isArray(body)).toBe(true);
    });

    test('should filter bookings by checkin date', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/booking`, {
        params: {
          checkin: '2025-06-01',
        },
      });

      expect(response.status()).toBe(200);
      const body = await response.json() as Array<{ bookingid: number }>;
      expect(Array.isArray(body)).toBe(true);
    });

    test('should filter bookings by checkout date', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/booking`, {
        params: {
          checkout: '2025-06-05',
        },
      });

      expect(response.status()).toBe(200);
      const body = await response.json() as Array<{ bookingid: number }>;
      expect(Array.isArray(body)).toBe(true);
    });

    test('should retrieve specific booking by ID', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/booking/${testBookingId}`);

      expect(response.status()).toBe(200);
      const body = await response.json() as BookingData;
      expect(body).toHaveProperty('firstname');
      expect(body).toHaveProperty('lastname');
      expect(body).toHaveProperty('totalprice');
      expect(body.firstname).toBe('TestUser');
    });

    test('should return 404 for non-existent booking ID', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/booking/999999999`);

      expect(response.status()).toBe(404);
    });

    test('should handle invalid booking ID format gracefully', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/booking/invalid-id`);

      expect([400, 404]).toContain(response.status());
    });
  });

  // ==================== BOOKING UPDATES ====================
  test.describe('Booking Updates (PUT /booking/{id})', () => {
    let updateTestBookingId: number;

    test.beforeAll(async ({ request }) => {
      // Authenticate first
      const authResponse = await request.post(`${API_BASE_URL}/auth`, {
        data: {
          username: 'admin',
          password: 'password123',
        },
      });
      const authBody = await authResponse.json() as AuthTokenResponse;
      authToken = authBody.token;

      // Create a booking for update tests
      const bookingData = createValidBookingData({ firstname: 'UpdateTest' });
      const response = await request.post(`${API_BASE_URL}/booking`, {
        data: bookingData,
      });
      const body = await response.json() as { bookingid: number };
      updateTestBookingId = body.bookingid;
      createdBookingIds.push(updateTestBookingId);
    });

    test('should update booking with valid authentication', async ({ request }) => {
      const updatedData = createValidBookingData({
        firstname: 'UpdatedName',
        totalprice: 350,
      });

      const response = await request.put(
        `${API_BASE_URL}/booking/${updateTestBookingId}`,
        {
          headers: {
            Cookie: `token=${authToken}`,
          },
          data: updatedData,
        }
      );

      expect(response.status()).toBe(200);
      const body = await response.json() as BookingData;
      expect(body.firstname).toBe('UpdatedName');
      expect(body.totalprice).toBe(350);
    });

    test('should update single field in booking', async ({ request }) => {
      const updateData = {
        firstname: 'PartialUpdate',
        lastname: 'Doe',
        totalprice: 400,
        depositpaid: false,
        bookingdates: {
          checkin: '2025-06-01',
          checkout: '2025-06-05',
        },
      };

      const response = await request.put(
        `${API_BASE_URL}/booking/${updateTestBookingId}`,
        {
          headers: {
            Cookie: `token=${authToken}`,
          },
          data: updateData,
        }
      );

      expect(response.status()).toBe(200);
      const body = await response.json() as BookingData;
      expect(body.firstname).toBe('PartialUpdate');
    });

    test('should reject update without authentication', async ({ request }) => {
      const updatedData = createValidBookingData({ firstname: 'Unauthorized' });

      const response = await request.put(
        `${API_BASE_URL}/booking/${updateTestBookingId}`,
        {
          data: updatedData,
        }
      );

      expect(response.status()).toBe(403);
    });

    test('should reject update with invalid token', async ({ request }) => {
      const updatedData = createValidBookingData({ firstname: 'InvalidToken' });

      const response = await request.put(
        `${API_BASE_URL}/booking/${updateTestBookingId}`,
        {
          headers: {
            Cookie: 'token=invalid-token-12345',
          },
          data: updatedData,
        }
      );

      expect(response.status()).toBe(403);
    });

    test('should return 404 for non-existent booking update', async ({ request }) => {
      const updatedData = createValidBookingData();

      const response = await request.put(`${API_BASE_URL}/booking/999999999`, {
        headers: {
          Cookie: `token=${authToken}`,
        },
        data: updatedData,
      });

      expect(response.status()).toBe(404);
    });
  });

  // ==================== BOOKING DELETION ====================
  test.describe('Booking Deletion (DELETE /booking/{id})', () => {
    let deleteTestBookingId: number;

    test.beforeAll(async ({ request }) => {
      // Authenticate first
      const authResponse = await request.post(`${API_BASE_URL}/auth`, {
        data: {
          username: 'admin',
          password: 'password123',
        },
      });
      const authBody = await authResponse.json() as AuthTokenResponse;
      authToken = authBody.token;

      // Create a booking for deletion test
      const bookingData = createValidBookingData({ firstname: 'DeleteTest' });
      const response = await request.post(`${API_BASE_URL}/booking`, {
        data: bookingData,
      });
      const body = await response.json() as { bookingid: number };
      deleteTestBookingId = body.bookingid;
    });

    test('should delete booking with valid authentication', async ({ request }) => {
      const response = await request.delete(
        `${API_BASE_URL}/booking/${deleteTestBookingId}`,
        {
          headers: {
            Cookie: `token=${authToken}`,
          },
        }
      );

      expect(response.status()).toBe(201);
    });

    test('should verify deleted booking returns 404', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/booking/${deleteTestBookingId}`);

      expect(response.status()).toBe(404);
    });

    test('should reject delete without authentication', async ({ request }) => {
      // Create a new booking to delete
      const bookingData = createValidBookingData({ firstname: 'NoAuthDelete' });
      const createResponse = await request.post(`${API_BASE_URL}/booking`, {
        data: bookingData,
      });
      const createBody = await createResponse.json() as { bookingid: number };
      const bookingId = createBody.bookingid;
      createdBookingIds.push(bookingId);

      const response = await request.delete(`${API_BASE_URL}/booking/${bookingId}`);

      expect(response.status()).toBe(403);
    });

    test('should reject delete with invalid token', async ({ request }) => {
      // Create a new booking to delete
      const bookingData = createValidBookingData({ firstname: 'InvalidTokenDelete' });
      const createResponse = await request.post(`${API_BASE_URL}/booking`, {
        data: bookingData,
      });
      const createBody = await createResponse.json() as { bookingid: number };
      const bookingId = createBody.bookingid;
      createdBookingIds.push(bookingId);

      const response = await request.delete(
        `${API_BASE_URL}/booking/${bookingId}`,
        {
          headers: {
            Cookie: 'token=invalid-token',
          },
        }
      );

      expect(response.status()).toBe(403);
    });

    test('should return 404 for deleting non-existent booking', async ({ request }) => {
      const response = await request.delete(
        `${API_BASE_URL}/booking/999999999`,
        {
          headers: {
            Cookie: `token=${authToken}`,
          },
        }
      );

      expect(response.status()).toBe(404);
    });
  });

  // ==================== PARTIAL UPDATE (PATCH) ====================
  test.describe('Booking Partial Update (PATCH /booking/{id})', () => {
    let patchTestBookingId: number;

    test.beforeAll(async ({ request }) => {
      // Authenticate
      const authResponse = await request.post(`${API_BASE_URL}/auth`, {
        data: {
          username: 'admin',
          password: 'password123',
        },
      });
      const authBody = await authResponse.json() as AuthTokenResponse;
      authToken = authBody.token;

      // Create booking for patch tests
      const bookingData = createValidBookingData({ firstname: 'PatchTest' });
      const response = await request.post(`${API_BASE_URL}/booking`, {
        data: bookingData,
      });
      const body = await response.json() as { bookingid: number };
      patchTestBookingId = body.bookingid;
      createdBookingIds.push(patchTestBookingId);
    });

    test('should partially update booking with PATCH', async ({ request }) => {
      const patchData = {
        firstname: 'PatchedFirstName',
        totalprice: 275,
      };

      const response = await request.patch(
        `${API_BASE_URL}/booking/${patchTestBookingId}`,
        {
          headers: {
            Cookie: `token=${authToken}`,
          },
          data: patchData,
        }
      );

      expect(response.status()).toBe(200);
      const body = await response.json() as BookingData;
      expect(body.firstname).toBe('PatchedFirstName');
      expect(body.totalprice).toBe(275);
    });

    test('should reject PATCH without authentication', async ({ request }) => {
      const patchData = { firstname: 'Unauthorized' };

      const response = await request.patch(
        `${API_BASE_URL}/booking/${patchTestBookingId}`,
        {
          data: patchData,
        }
      );

      expect(response.status()).toBe(403);
    });
  });

  // ==================== DATA VALIDATION & EDGE CASES ====================
  test.describe('Data Validation & Edge Cases', () => {
    test('should handle empty string in firstname', async ({ request }) => {
      const bookingData = createValidBookingData({ firstname: '' });

      const response = await request.post(`${API_BASE_URL}/booking`, {
        data: bookingData,
      });

      // API may accept or reject - verify consistent behavior
      expect([200, 400]).toContain(response.status());
    });

    test('should handle very long names', async ({ request }) => {
      const longName = 'A'.repeat(500);
      const bookingData = createValidBookingData({
        firstname: longName,
        lastname: longName,
      });

      const response = await request.post(`${API_BASE_URL}/booking`, {
        data: bookingData,
      });

      expect([200, 400]).toContain(response.status());
      if (response.status() === 200) {
        const body = await response.json() as { bookingid: number };
        createdBookingIds.push(body.bookingid);
      }
    });

    test('should handle negative price', async ({ request }) => {
      const bookingData = createValidBookingData({ totalprice: -100 });

      const response = await request.post(`${API_BASE_URL}/booking`, {
        data: bookingData,
      });

      // Verify API handles negative prices (accepts or rejects consistently)
      expect([200, 400]).toContain(response.status());
      if (response.status() === 200) {
        const body = await response.json() as { bookingid: number };
        createdBookingIds.push(body.bookingid);
      }
    });

    test('should handle checkout before checkin', async ({ request }) => {
      const bookingData = createValidBookingData({
        bookingdates: {
          checkin: '2025-06-05',
          checkout: '2025-06-01', // Checkout before checkin
        },
      });

      const response = await request.post(`${API_BASE_URL}/booking`, {
        data: bookingData,
      });

      // Verify API behavior
      expect([200, 400]).toContain(response.status());
      if (response.status() === 200) {
        const body = await response.json() as { bookingid: number };
        createdBookingIds.push(body.bookingid);
      }
    });

    test('should handle same checkin and checkout date', async ({ request }) => {
      const bookingData = createValidBookingData({
        bookingdates: {
          checkin: '2025-06-01',
          checkout: '2025-06-01',
        },
      });

      const response = await request.post(`${API_BASE_URL}/booking`, {
        data: bookingData,
      });

      expect([200, 400]).toContain(response.status());
      if (response.status() === 200) {
        const body = await response.json() as { bookingid: number };
        createdBookingIds.push(body.bookingid);
      }
    });

    test('should handle invalid date format', async ({ request }) => {
      const bookingData = createValidBookingData({
        bookingdates: {
          checkin: 'invalid-date',
          checkout: 'also-invalid',
        },
      });

      const response = await request.post(`${API_BASE_URL}/booking`, {
        data: bookingData,
      });

      expect([400, 500]).toContain(response.status());
    });
  });

  // ==================== RESPONSE STRUCTURE VALIDATION ====================
  test.describe('Response Structure Validation', () => {
    test('should have correct response headers for booking creation', async ({ request }) => {
      const bookingData = createValidBookingData();

      const response = await request.post(`${API_BASE_URL}/booking`, {
        data: bookingData,
      });

      expect(response.status()).toBe(200);
      const contentType = response.headers()['content-type'];
      expect(contentType).toContain('application/json');
    });

    test('should return properly formatted booking object', async ({ request }) => {
      const bookingData = createValidBookingData();

      const response = await request.post(`${API_BASE_URL}/booking`, {
        data: bookingData,
      });

      const body = await response.json() as { booking: BookingData };
      const booking = body.booking;

      expect(booking).toEqual(
        expect.objectContaining({
          firstname: expect.any(String),
          lastname: expect.any(String),
          totalprice: expect.any(Number),
          depositpaid: expect.any(Boolean),
          bookingdates: expect.objectContaining({
            checkin: expect.any(String),
            checkout: expect.any(String),
          }),
        })
      );

      const bodyWithId = await response.json() as { bookingid: number };
      createdBookingIds.push(bodyWithId.bookingid);
    });

    test('should preserve additional needs in response', async ({ request }) => {
      const bookingData = createValidBookingData({
        additionalneeds: 'Specific test additional needs',
      });

      const response = await request.post(`${API_BASE_URL}/booking`, {
        data: bookingData,
      });

      const body = await response.json() as { booking: BookingData; bookingid: number };
      expect(body.booking.additionalneeds).toBe('Specific test additional needs');
      createdBookingIds.push(body.bookingid);
    });
  });

  // ==================== PERFORMANCE & STRESS TESTS ====================
  test.describe('Performance & Stress Tests', () => {
    test('should handle rapid consecutive booking creations', async ({ request }) => {
      const promises = [];
      const numRequests = 5;

      for (let i = 0; i < numRequests; i++) {
        const bookingData = createValidBookingData({
          firstname: `RapidTest${i}`,
        });
        promises.push(
          request.post(`${API_BASE_URL}/booking`, { data: bookingData })
        );
      }

      const responses = await Promise.all(promises);

      for (const response of responses) {
        expect(response.status()).toBe(200);
        const body = await response.json() as { bookingid: number };
        createdBookingIds.push(body.bookingid);
      }
    });

    test('should retrieve large list of bookings without timeout', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/booking`, {
        timeout: API_TIMEOUT,
      });

      expect(response.status()).toBe(200);
      expect(response.ok()).toBe(true);
    });
  });

  // ==================== CONTENT TYPE & ENCODING ====================
  test.describe('Content Type & Encoding Tests', () => {
    test('should accept JSON content with proper headers', async ({ request }) => {
      const bookingData = createValidBookingData();

      const response = await request.post(`${API_BASE_URL}/booking`, {
        headers: {
          'Content-Type': 'application/json',
        },
        data: bookingData,
      });

      expect(response.status()).toBe(200);
      const body = await response.json() as { bookingid: number };
      createdBookingIds.push(body.bookingid);
    });

    test('should handle Unicode characters in response', async ({ request }) => {
      const bookingData = createValidBookingData({
        firstname: '日本',
        lastname: '太郎',
        additionalneeds: '特別なリクエスト',
      });

      const response = await request.post(`${API_BASE_URL}/booking`, {
        data: bookingData,
      });

      expect(response.status()).toBe(200);
      const body = await response.json() as { bookingid: number };
      createdBookingIds.push(body.bookingid);
    });
  });
});
