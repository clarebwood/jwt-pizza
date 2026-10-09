import { Page } from '@playwright/test';
import { test, expect } from './testSetup';
import { Role, User } from '../src/service/pizzaService';


async function basicInit(page: Page) {
  let loggedInUser: User | undefined;
  const validUsers: Record<string, User> = {
    'd@jwt.com': { id: '3', name: 'Kai Chen', email: 'd@jwt.com', password: 'a', roles: [{ role: Role.Diner }] },
    'admin@jwt.com': { id: '1', name: 'Ada Admin', email: 'admin@jwt.com', password: 'a', roles: [{ role: Role.Admin }] },
    'franchisee@jwt.com': { id: '2', name: 'Fran Chisee', email: 'franchisee@jwt.com', password: 'a', roles: [{ role: Role.Franchisee }] },
  };

await page.route('*/**/api/auth', async (route) => {
  if (route.request().method() === 'DELETE') {
    await route.fulfill({ json: {} });
    return;
  }

  if (route.request().method() === 'POST') {
    const registerReq = route.request().postDataJSON();

    const registerRes = {
      user: {
        id: '4',
        name: registerReq.name,
        email: registerReq.email,
        password: registerReq.password,
        roles: [{ role: Role.Diner }],
      },
      token: 'newtoken',
    };

    await route.fulfill({ json: registerRes });
    return;
  }

  const loginReq = route.request().postDataJSON();
  const user = validUsers[loginReq.email];

  if (!user || user.password !== loginReq.password) {
    await route.fulfill({ status: 401, json: { error: 'Unauthorized' } });
    return;
  }

  loggedInUser = validUsers[loginReq.email];

  const loginRes = {
    user: loggedInUser,
    token: 'abcdef',
  };

  expect(route.request().method()).toBe('PUT');
  await route.fulfill({ json: loginRes });
});

  await page.route('*/**/api/user/me', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: loggedInUser });
  });

  await page.route('*/**/api/order/menu', async (route) => {
    const menuRes = [
      { id: 1, title: 'Veggie', image: 'pizza1.png', price: 0.0038, description: 'A garden of delight' },
      { id: 2, title: 'Pepperoni', image: 'pizza2.png', price: 0.0042, description: 'Spicy treat' },
    ];
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: menuRes });
  });

  await page.route(/\/api\/franchise(\/.*)?(\?.*)?$/, async (route) => {
  const franchiseRes = {
    franchises: [
      {
        id: 2,
        name: 'LotaPizza',
        stores: [
          { id: 4, name: 'Lehi', totalRevenue: 100 },
          { id: 5, name: 'Springville', totalRevenue: 200 },
          { id: 6, name: 'American Fork', totalRevenue: 300 },
        ],
      },
      { id: 3, name: 'PizzaCorp', stores: [{ id: 7, name: 'Spanish Fork' }] },
      { id: 4, name: 'topSpot', stores: [] },
    ],
  };

  expect(route.request().method()).toBe('GET');
  await route.fulfill({ json: franchiseRes });
});

  await page.route('*/**/api/order', async (route) => {
  if (route.request().method() === 'GET') {
    await route.fulfill({
      json: {
        orders: [
          {
            id: '23',
            franchiseId: '2',
            storeId: '4',
            date: '2026-10-07',
            items: [
              {
                menuId: '1',
                description: 'Veggie',
                price: 0.0038,
              },
            ],
          },
        ],
      },
    });
    return;
  }

  const orderReq = route.request().postDataJSON();
  const orderRes = {
    order: { ...orderReq, id: 23 },
    jwt: 'eyJpYXQ',
  };

  expect(route.request().method()).toBe('POST');
  await route.fulfill({ json: orderRes });
});

  await page.goto('/');
}

test('login', async ({ page }) => {
  await basicInit(page);
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('d@jwt.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('a');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page.getByRole('link', { name: 'KC' })).toBeVisible();
});

test('purchase with login', async ({ page }) => {
  await basicInit(page);

  await page.getByRole('button', { name: 'Order now' }).click();

  await expect(page.locator('h2')).toContainText('Awesome is a click away');
  await page.getByRole('combobox').selectOption('4');
  await page.getByRole('link', { name: 'Image Description Veggie A' }).click();
  await page.getByRole('link', { name: 'Image Description Pepperoni' }).click();
  await expect(page.locator('form')).toContainText('Selected pizzas: 2');
  await page.getByRole('button', { name: 'Checkout' }).click();

  await page.getByPlaceholder('Email address').fill('d@jwt.com');
  await page.getByPlaceholder('Password').fill('a');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page.getByRole('main')).toContainText('Send me those 2 pizzas right now!');
  await expect(page.locator('tbody')).toContainText('Veggie');
  await expect(page.locator('tbody')).toContainText('Pepperoni');
  await expect(page.locator('tfoot')).toContainText('0.008 ₿');
  await page.getByRole('button', { name: 'Pay now' }).click();

  await expect(page.getByText('0.008')).toBeVisible();
});

test('login with incorrect password', async ({ page }) => {
  await basicInit(page);

  await page.getByRole('link', { name: 'Login' }).click();

  await page
    .getByRole('textbox', { name: 'Email address' })
    .fill('d@jwt.com');

  await page
    .getByRole('textbox', { name: 'Password' })
    .fill('wrong-password');

  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});

test('logout', async ({ page }) => {
  await basicInit(page);

  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('d@jwt.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('a');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page.getByRole('link', { name: 'KC' })).toBeVisible();

  await page.getByRole('link', { name: 'Logout' }).click();

  await expect(page.getByRole('link', { name: 'Login' })).toBeVisible();
});

test('register', async ({ page }) => {
  await basicInit(page);

  await page.getByRole('link', { name: 'Login' }).click();

  await page.getByRole('link', { name: 'Register' }).click();

  await page.getByRole('textbox', { name: 'Name' }).fill('Jane Doe');
  await page.getByRole('textbox', { name: 'Email address' }).fill('jane@jwt.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('password');

  await page.getByRole('button', { name: 'Register' }).click();

  await expect(page.getByRole('link', { name: 'JD' })).toBeVisible();
});

test('diner dashboard', async ({ page }) => {
  await basicInit(page);

  await page.getByRole('link', { name: 'Login' }).click();

  await page.getByRole('textbox', { name: 'Email address' }).fill('d@jwt.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('a');
  await page.getByRole('button', { name: 'Login' }).click();

  await page.getByRole('link', { name: 'KC' }).click();

  await expect(page.getByRole('heading', { name: 'Your pizza kitchen' })).toBeVisible();
  await expect(page.getByText('Kai Chen')).toBeVisible();
  await expect(page.getByText('d@jwt.com')).toBeVisible();
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByRole('cell', { name: '23' })).toBeVisible();
});

test('admin dashboard', async ({ page }) => {
  await basicInit(page);

  const franchiseRequests: { page: string | null; limit: string | null; name: string | null }[] = [];
  await page.route(/\/api\/franchise(\/.*)?(\?.*)?$/, async (route) => {
    const requestUrl = new URL(route.request().url());
    const query = {
      page: requestUrl.searchParams.get('page'),
      limit: requestUrl.searchParams.get('limit'),
      name: requestUrl.searchParams.get('name'),
    };
    franchiseRequests.push(query);

    if (query.name === '*PizzaCorp*') {
      await route.fulfill({
        json: {
          franchises: [{ id: '3', name: 'PizzaCorp', stores: [{ id: '7', name: 'Spanish Fork', totalRevenue: 200 }] }],
          more: false,
        },
      });
      return;
    }

    const franchises = query.page === '1'
      ? [
          { id: '5', name: 'BistroPizza', stores: [{ id: '9', name: 'Orem', totalRevenue: 400 }] },
          { id: '6', name: 'SicilianPizza', stores: [{ id: '10', name: 'Provo', totalRevenue: 500 }] },
        ]
      : [
          { id: '2', name: 'LotaPizza', admins: [{ email: 'admin@jwt.com', name: 'Ada Admin' }], stores: [{ id: '4', name: 'Lehi', totalRevenue: 100 }] },
          { id: '3', name: 'PizzaCorp', stores: [{ id: '7', name: 'Spanish Fork', totalRevenue: 200 }] },
          { id: '4', name: 'topSpot', stores: [] },
        ];

    await route.fulfill({ json: { franchises, more: query.page !== '1' } });
  });

  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('admin@jwt.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('a');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.getByRole('link', { name: 'Admin' }).click();

  const table = page.getByRole('table');
  await expect(page.getByRole('heading', { name: "Mama Ricci's kitchen" })).toBeVisible();
  await expect(table).toContainText('Franchise');
  await expect(table).toContainText('LotaPizza');
  await expect(table).toContainText('Lehi');
  await expect(table).toContainText('100 ₿');
  await expect(table.locator('tbody')).toHaveCount(3);

  const previousPage = page.getByRole('button', { name: '«' });
  const nextPage = page.getByRole('button', { name: '»' });
  await expect(previousPage).toBeDisabled();
  await expect(nextPage).toBeEnabled();
  await nextPage.click();
  await expect(table).toContainText('BistroPizza');
  await expect(table).toContainText('SicilianPizza');
  await expect(table).not.toContainText('LotaPizza');
  await expect(previousPage).toBeEnabled();
  await expect(nextPage).toBeDisabled();
  await previousPage.click();
  await expect(table).toContainText('LotaPizza');

  await page.getByPlaceholder('Filter franchises').fill('PizzaCorp');
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(table.locator('tbody')).toHaveCount(1);
  await expect(table).toContainText('PizzaCorp');
  await expect(table).not.toContainText('LotaPizza');
  await expect(table).not.toContainText('topSpot');
  expect(franchiseRequests).toContainEqual({ page: '1', limit: '3', name: '*' });
  expect(franchiseRequests).toContainEqual({ page: '0', limit: '10', name: '*PizzaCorp*' });
});

test('create franchise', async ({ page }) => {
  await basicInit(page);

  let createdFranchiseRequest: Record<string, unknown> | undefined;
  await page.route(/\/api\/franchise(\/.*)?(\?.*)?$/, async (route) => {
    if (route.request().method() === 'POST') {
      createdFranchiseRequest = route.request().postDataJSON();
      await route.fulfill({
        json: {
          ...createdFranchiseRequest,
          id: '10',
        },
      });
      return;
    }

    const franchises = createdFranchiseRequest
      ? [{ ...createdFranchiseRequest, id: '10' }]
      : [];
    await route.fulfill({ json: { franchises, more: false } });
  });

  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('admin@jwt.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('a');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.getByRole('link', { name: 'Admin' }).click();
  await page.getByRole('button', { name: 'Add Franchise' }).click();

  await expect(page.getByRole('heading', { name: 'Create franchise' })).toBeVisible();
  await page.getByPlaceholder('franchise name').fill('New Pie');
  await page.getByPlaceholder('franchisee admin email').fill('owner@newpie.com');
  await page.getByRole('button', { name: 'Create' }).click();

  await expect(page.getByRole('heading', { name: "Mama Ricci's kitchen" })).toBeVisible();
  await expect(page.getByRole('table')).toContainText('New Pie');
  expect(createdFranchiseRequest).toEqual({
    id: '',
    name: 'New Pie',
    stores: [],
    admins: [{ email: 'owner@newpie.com' }],
  });
});

test('create store', async ({ page }) => {
  await basicInit(page);

  const franchise = { id: '2', name: 'LotaPizza', stores: [] as { id: string; name: string }[] };
  let createdStoreRequest: { id: string; name: string } | undefined;
  let createStorePath: string | undefined;
  await page.route(/\/api\/franchise(\/.*)?(\?.*)?$/, async (route) => {
    if (route.request().method() === 'POST') {
      createStorePath = new URL(route.request().url()).pathname;
      const storeRequest = route.request().postDataJSON() as { id: string; name: string };
      createdStoreRequest = storeRequest;
      const createdStore = { ...storeRequest, id: '8' };
      franchise.stores = [createdStore];
      await route.fulfill({ json: createdStore });
      return;
    }

    await route.fulfill({ json: [franchise] });
  });

  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('franchisee@jwt.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('a');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.getByRole('link', { name: 'Franchise', exact: true }).first().click();

  await expect(page.getByRole('heading', { name: 'LotaPizza' })).toBeVisible();
  await expect(page.getByRole('table')).toBeVisible();
  await page.getByRole('button', { name: 'Create store' }).click();

  await expect(page.getByRole('heading', { name: 'Create store' })).toBeVisible();
  await page.getByPlaceholder('store name').fill('Downtown');
  await page.getByRole('button', { name: 'Create' }).click();

  await expect(page.getByRole('heading', { name: 'LotaPizza' })).toBeVisible();
  await expect(page.getByRole('table')).toContainText('Downtown');
  expect(createStorePath).toBe('/api/franchise/2/store');
  expect(createdStoreRequest).toEqual({ id: '', name: 'Downtown' });
});

test('franchise information page', async ({ page }) => {
  await basicInit(page);

  await page.getByLabel('Global').getByRole('link', { name: 'Franchise' }).click();

  await expect(
    page.getByRole('heading', { name: 'So you want a piece of the pie?' })
  ).toBeVisible();

  await expect(page.getByText('Call now')).toBeVisible();
  await expect(page.getByText('800-555-5555')).toBeVisible();

  await expect(page.getByText('2020')).toBeVisible();
  await expect(page.getByText('2021')).toBeVisible();
  await expect(page.getByText('2022')).toBeVisible();
});