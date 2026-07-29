import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

// Use require for supertest to avoid ESM/CJS module resolution issues
// eslint-disable-next-line @typescript-eslint/no-var-requires
const request = require('supertest');

describe('Capacity Service (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    prisma = app.get(PrismaService);

    // Get auth token
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'admin', password: 'admin' })
      .expect(201);

    authToken = loginRes.body.accessToken;

    // Seed a test program
    await prisma.program.upsert({
      where: { id: 'e2e_test_prog' },
      update: {},
      create: {
        id: 'e2e_test_prog',
        name: 'E2E Test Program',
        currency: 'USD',
        totalLimit: 1000_00, // $1,000.00
        reservedAmount: 0,
        version: 1,
      },
    });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.reservation.deleteMany({
      where: { programId: 'e2e_test_prog' },
    });
    await prisma.program.delete({ where: { id: 'e2e_test_prog' } });
    await app.close();
  });

  describe('Auth', () => {
    it('POST /auth/login - should return JWT token', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'admin', password: 'admin' })
        .expect(201);

      expect(res.body.accessToken).toBeDefined();
      expect(typeof res.body.accessToken).toBe('string');
    });

    it('POST /auth/login - should reject invalid credentials', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'admin', password: 'wrong' })
        .expect(401);
    });
  });

  describe('Capacity', () => {
    it('GET /programs/:id/capacity - should return capacity', async () => {
      const res = await request(app.getHttpServer())
        .get('/programs/e2e_test_prog/capacity')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body).toEqual({
        programId: 'e2e_test_prog',
        currency: 'USD',
        totalLimit: 1000_00,
        reservedAmount: 0,
        availableAmount: 1000_00,
      });
    });

    it('GET /programs/:id/capacity - should reject without auth', async () => {
      await request(app.getHttpServer())
        .get('/programs/e2e_test_prog/capacity')
        .expect(401);
    });
  });

  describe('Reservations', () => {
    it('POST /programs/:id/reservations - should create reservation', async () => {
      const res = await request(app.getHttpServer())
        .post('/programs/e2e_test_prog/reservations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          invoiceId: 'inv_001',
          amount: 200_00, // $200.00
          currency: 'USD',
        })
        .expect(201);

      expect(res.body).toEqual({
        reservationId: expect.any(String),
        status: 'ACTIVE',
      });

      // Verify capacity was reduced
      const capacityRes = await request(app.getHttpServer())
        .get('/programs/e2e_test_prog/capacity')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(capacityRes.body.reservedAmount).toBe(200_00);
      expect(capacityRes.body.availableAmount).toBe(800_00);
    });

    it('POST /programs/:id/reservations - should reject duplicate invoice', async () => {
      await request(app.getHttpServer())
        .post('/programs/e2e_test_prog/reservations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          invoiceId: 'inv_001', // Same invoice as above
          amount: 100_00,
          currency: 'USD',
        })
        .expect(409);
    });

    it('POST /programs/:id/reservations - should reject currency mismatch', async () => {
      await request(app.getHttpServer())
        .post('/programs/e2e_test_prog/reservations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          invoiceId: 'inv_wrong_currency',
          amount: 100_00,
          currency: 'EUR', // Program is in USD
        })
        .expect(400);
    });

    it('POST /programs/:id/reservations - should reject insufficient capacity', async () => {
      await request(app.getHttpServer())
        .post('/programs/e2e_test_prog/reservations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          invoiceId: 'inv_too_large',
          amount: 9999_00, // Way more than available
          currency: 'USD',
        })
        .expect(400);
    });

    it('POST /programs/:id/releases - should return 404 for non-existent reservation', async () => {
      await request(app.getHttpServer())
        .post('/programs/e2e_test_prog/releases')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reservationId: 'non_existent',
        })
        .expect(404);
    });
  });
});
