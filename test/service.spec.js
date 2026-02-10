const request = require('supertest');
const app = require('../src/service');
const version = require('../src/version.json');
const { Role, DB } = require('../src/database/database.js');

// async function createAdminUser() {
//   let user = { password: 'toomanysecrets', roles: [{ role: Role.Admin }] };
//   user.name = randomName();
//   user.email = user.name + '@admin.com';
//
//   await DB.addUser(user);
//   user.password = 'toomanysecrets';
//
//   return user;
// }

async function createAdminUser() {
  let user = { password: 'toomanysecrets', roles: [{ role: Role.Admin }] };
  user.name = randomName();
  user.email = user.name + '@admin.com';

  await DB.addUser(user);
  user.password = 'toomanysecrets';

  return user;
}

function randomName() {
  return Math.random().toString(36).substring(2, 12)
}


const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
let testUserAuthToken;

beforeEach(async () => {
  testUser.email = randomName() + '@test.com';
  const registerRes = await request(app).post('/api/auth').send(testUser);
  testUserAuthToken = registerRes.body.token;
});

describe('auth', () => {
  test('login', async () => {
    const loginRes = await request(app).put('/api/auth').send(testUser);
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);

    // eslint-disable-next-line no-unused-vars
    const { password, ...user } = { ...testUser, roles: [{ role: 'diner' }] };
    expect(loginRes.body.user).toMatchObject(user);
    expect(loginRes.body.user.password).toBeUndefined();
  });

  test('register', async () => {
    const newUser = {
      name: `user-${randomName()}`,
      email: `${randomName()}@test.com`,
      password: 'a',
    };

    const registerRes = await request(app).post('/api/auth').send(newUser);
    expect(registerRes.status).toBe(200);
    expect(registerRes.body.token).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);

    const { password, ...expectedUser } = { ...newUser, roles: [{ role: 'diner' }] };
    expect(registerRes.body.user).toMatchObject(expectedUser);
    expect(registerRes.body.user.password).toBeUndefined();
    expect(password).toBe(password);
  });

  test('logout', async () => {
    const logoutRes = await request(app).delete('/api/auth').set('Authorization', `Bearer ${testUserAuthToken}`);
    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body).toMatchObject({ message: 'logout successful' });

    const secondLogoutRes = await request(app).delete('/api/auth').set('Authorization', `Bearer ${testUserAuthToken}`);
    expect(secondLogoutRes.status).toBe(401);
    expect(secondLogoutRes.body).toMatchObject({ message: 'unauthorized' });
  });
});

describe('base', () => {
  test('root', async () => {
    const rootRes = await request(app).get('/').send();
    expect(rootRes.body.message).toBe('welcome to JWT Pizza');
  });

  test('docs', async () => {
    const rootRes = await request(app).get('/api/docs').send();
    expect(rootRes.body.version).toBe(version.version);
  });
});

describe('user', () => {
  test('me', async () => {
    const meRes = await request(app).get('/api/user/me').set('Authorization', `Bearer ${testUserAuthToken}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.email).toBe(testUser.email);
    expect(meRes.body.name).toBe(testUser.name);
    expect(meRes.body.roles).toMatchObject([{ role: 'diner' }]);
  });

  test('update', async () => {
    const loginRes = await request(app).put('/api/auth').send(testUser);
    const token = loginRes.body.token;

    const meRes = await request(app).get('/api/user/me').set('Authorization', `Bearer ${token}`);
    const userId = meRes.body.id;

    const updatedName = `updated-${randomName()}`;
    const updateRes = await request(app)
      .put(`/api/user/${userId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: updatedName, email: testUser.email, password: testUser.password });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.user).toMatchObject({ id: userId, name: updatedName, email: testUser.email });
    expect(updateRes.body.token).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);

    testUser.name = updatedName;
  });
});

describe('order', () => {
  let adminToken;
  let menuItemId;
  let originalFetch;

  async function ensureMenuItem() {
    if (menuItemId) return menuItemId;

    const menuItem = {
      title: `Test-${randomName()}`,
      description: 'Test item',
      image: 'pizza-test.png',
      price: 0.01,
    };

    const addRes = await request(app)
      .put('/api/order/menu')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(menuItem);
    expect(addRes.status).toBe(200);
    const added = addRes.body.find((item) => item.title === menuItem.title);
    menuItemId = added?.id;
    return menuItemId;
  }

  beforeAll(async () => {
    const adminUser = await createAdminUser();
    const loginRes = await request(app).put('/api/auth').send(adminUser);
    adminToken = loginRes.body.token;

    originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ reportUrl: 'https://example.com/report', jwt: 'factory-jwt' }),
    });
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  test('menu', async () => {
    const menuRes = await request(app).get('/api/order/menu').send();
    expect(menuRes.status).toBe(200);
    expect(Array.isArray(menuRes.body)).toBe(true);
  });

  test('add menu item', async () => {
    const id = await ensureMenuItem();
    expect(id).toBeDefined();

    const menuRes = await request(app).get('/api/order/menu').send();
    expect(menuRes.status).toBe(200);
    expect(Array.isArray(menuRes.body)).toBe(true);
    expect(menuRes.body.find((item) => item.id === id)).not.toBeNull();
  });

  test('get orders', async () => {
    const loginRes = await request(app).put('/api/auth').send(testUser);
    const token = loginRes.body.token;

    const ordersRes = await request(app).get('/api/order').set('Authorization', `Bearer ${token}`);
    expect(ordersRes.status).toBe(200);
    expect(ordersRes.body).toHaveProperty('orders');
    expect(Array.isArray(ordersRes.body.orders)).toBe(true);
  });

  test('create order', async () => {
    const loginRes = await request(app).put('/api/auth').send(testUser);
    const token = loginRes.body.token;

    const id = await ensureMenuItem();
    const orderRes = await request(app)
      .post('/api/order')
      .set('Authorization', `Bearer ${token}`)
      .send({
        franchiseId: 1,
        storeId: 1,
        items: [{ menuId: id, description: 'Test item', price: 0.01 }],
      });

    expect(orderRes.status).toBe(200);
    expect(orderRes.body.order).toBeDefined();
    expect(orderRes.body.order.items).toMatchObject([{ menuId: id, description: 'Test item', price: 0.01 }]);
    expect(orderRes.body.jwt).toBe('factory-jwt');
  });
});
