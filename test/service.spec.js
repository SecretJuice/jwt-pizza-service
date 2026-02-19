const request = require('supertest');
const app = require('../src/service');
const version = require('../src/version.json');
const { Role, DB } = require('../src/database/database.js');

async function createAdminUser() {
  let user = { password: 'toomanysecrets', roles: [{ role: Role.Admin }] };
  user.name = randomName();
  user.email = user.name + '@admin.com';

  await DB.addUser(user);
  user.password = 'toomanysecrets';

  return user;
}

async function createDinerUser() {
  let name = randomName();
  let user = {
    password: 'toomanysecrets',
    roles: [{ role: Role.Diner }],
    name: name,
    email: name + '@diner.com'
  }
  await DB.addUser(user);

  return user;
}

// async function createFranchiseeUser() {
//   let user = { password: 'toomanysecrets', roles: [{ role: Role.Franchisee, object: 'pizzaPocket'  }] };
//   user.name = randomName();
//   user.email = user.name + '@franchisee.com';
//
//   await DB.addUser(user);
//   user.password = 'toomanysecrets';
//
//   return user;
// }

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
  let adminToken;

  beforeAll(async () => {
    const adminUser = await createAdminUser();
    const loginRes = await request(app).put('/api/auth').send(adminUser);
    adminToken = loginRes.body.token;
  });

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
  test('list users', async () => {

    const testUsers = []
    for (let i = 0; i < 10; i++) {
      const testUser = await createDinerUser();
      testUsers.push(testUser)
    }


    const unauthorizedRes = await request(app).get('/api/user').set('Authorization', `Bearer ${testUserAuthToken}`);
    expect(unauthorizedRes.status).toBe(403);

    let listUsersRes = await request(app).get('/api/user').set('Authorization', `Bearer ${adminToken}`);
    expect(listUsersRes.status).toBe(200);
    expect(listUsersRes.body.users.length).toBe(10);
    expect(listUsersRes.body.more).toBe(true);

    listUsersRes = await request(app).get(`/api/user?name=${testUsers[0].name}`).set('Authorization', `Bearer ${adminToken}`);
    expect(listUsersRes.status).toBe(200);
    expect(listUsersRes.body.users.length).toBe(1);
    expect(listUsersRes.body.more).toBe(false);

    listUsersRes = await request(app).get(`/api/user?limit=4`).set('Authorization', `Bearer ${adminToken}`);
    expect(listUsersRes.status).toBe(200);
    expect(listUsersRes.body.users.length).toBe(4);
    expect(listUsersRes.body.more).toBe(true);

    const firstPageUserIds = new Set(listUsersRes.body.users.map((u) => u.id));

    listUsersRes = await request(app).get(`/api/user?page=2&limit=4`).set('Authorization', `Bearer ${adminToken}`);
    expect(listUsersRes.status).toBe(200);
    expect(listUsersRes.body.users.length).toBe(4);
    expect(listUsersRes.body.more).toBe(true);

    listUsersRes.body.users.forEach((u) => {
      expect(firstPageUserIds.has(u.id)).toBe(false);
    });

  });
  test('delete user', async () => {
    const testUser = await createDinerUser();

    const unauthorizedRes = await request(app).delete('/api/user/' + testUser.name).set('Authorization', `Bearer ${testUserAuthToken}`);
    expect(unauthorizedRes.status).toBe(403);

    const deleteRes = await request(app).delete('/api/user/' + testUser.name).set('Authorization', `Bearer ${adminToken}`);
    expect(deleteRes.status).toBe(200);

    const tryGetRes = await request(app).get(`/api/user?name=${testUser.name}`).set('Authorization', `Bearer ${adminToken}`);
    expect(tryGetRes.body.users.length).toBe(0);

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

describe('franchise', () => {
  test('list franchises', async () => {
    const res = await request(app).get('/api/franchise').send();
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('franchises');
    expect(Array.isArray(res.body.franchises)).toBe(true);
    expect(res.body).toHaveProperty('more');
  });

  test('list user franchises', async () => {
    const loginRes = await request(app).put('/api/auth').send(testUser);
    const token = loginRes.body.token;

    const meRes = await request(app).get('/api/user/me').set('Authorization', `Bearer ${token}`);
    const userId = meRes.body.id;

    const res = await request(app).get(`/api/franchise/${userId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    
  });

  test('create franchise', async () => {
    const adminUser = await createAdminUser();
    const loginRes = await request(app).put('/api/auth').send(adminUser);
    const token = loginRes.body.token;

    const franchiseName = `franchise-${randomName()}`;
    const res = await request(app)
      .post('/api/franchise')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: franchiseName, admins: [{ email: adminUser.email }] });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: franchiseName });
    expect(res.body.admins).toEqual(
      expect.arrayContaining([expect.objectContaining({ email: adminUser.email })])
    );
    expect(res.body.id).toBeDefined();
  });

  test('delete franchise', async () => {
    const adminUser = await createAdminUser();
    const loginRes = await request(app).put('/api/auth').send(adminUser);
    const token = loginRes.body.token;

    const franchiseName = `franchise-${randomName()}`;
    const createRes = await request(app)
      .post('/api/franchise')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: franchiseName, admins: [{ email: adminUser.email }] });
    const franchiseId = createRes.body.id;

    const deleteRes = await request(app).delete(`/api/franchise/${franchiseId}`).send();
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body).toMatchObject({ message: 'franchise deleted' });
  });

  test('create store', async () => {
    const adminUser = await createAdminUser();
    const loginRes = await request(app).put('/api/auth').send(adminUser);
    const token = loginRes.body.token;

    const franchiseName = `franchise-${randomName()}`;
    const franchiseRes = await request(app)
      .post('/api/franchise')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: franchiseName, admins: [{ email: adminUser.email }] });

    const franchiseId = franchiseRes.body.id;
    const storeName = `store-${randomName()}`;
    const storeRes = await request(app)
      .post(`/api/franchise/${franchiseId}/store`)
      .set('Authorization', `Bearer ${token}`)
      .send({ franchiseId, name: storeName });

    expect(storeRes.status).toBe(200);
    expect(storeRes.body).toMatchObject({ name: storeName });
    expect(storeRes.body.id).toBeDefined();
  });

  test('delete store', async () => {
    const adminUser = await createAdminUser();
    const loginRes = await request(app).put('/api/auth').send(adminUser);
    const token = loginRes.body.token;

    const franchiseName = `franchise-${randomName()}`;
    const franchiseRes = await request(app)
      .post('/api/franchise')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: franchiseName, admins: [{ email: adminUser.email }] });

    const franchiseId = franchiseRes.body.id;
    const storeName = `store-${randomName()}`;
    const storeRes = await request(app)
      .post(`/api/franchise/${franchiseId}/store`)
      .set('Authorization', `Bearer ${token}`)
      .send({ franchiseId, name: storeName });

    const storeId = storeRes.body.id;
    const deleteRes = await request(app)
      .delete(`/api/franchise/${franchiseId}/store/${storeId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body).toMatchObject({ message: 'store deleted' });
  });
});
