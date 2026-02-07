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

beforeAll(async () => {
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
