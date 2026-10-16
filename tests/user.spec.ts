import { test, expect } from 'playwright-test-coverage';

test.describe.configure({ timeout: 30000 });

test('updateUser', async ({ page }) => {
  const email = 'user' + Math.floor(Math.random() * 10000) + '@jwt.com';
  const userLink = page.getByRole('link', { name: 'pd' });
  await page.goto('/');
  await page.getByRole('link', { name: 'Register' }).click();
  await page.getByRole('textbox', { name: 'Full name' }).fill('pizza diner');
  await page.getByRole('textbox', { name: 'Email address' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill('diner');
  await page.getByRole('button', { name: 'Register' }).click();

  await userLink.waitFor({ state: 'visible', timeout: 10000 });
  await userLink.click();

  await expect(page.getByRole('main')).toContainText('pizza diner');

  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page.locator('h3')).toContainText('Edit user');
  await page.getByRole('dialog').getByRole('textbox').first().fill('pizza dinerx');
  await page.getByRole('button', { name: 'Update' }).click();

  await page.waitForSelector('[role="dialog"].hidden', { state: 'attached' });

  await expect(page.getByRole('main')).toContainText('pizza diner');

  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page.locator('h3')).toContainText('Edit user');
  await page.getByRole('button', { name: 'Update' }).click();

  await page.waitForSelector('[role="dialog"].hidden', { state: 'attached' });

  await expect(page.getByRole('main')).toContainText('pizza diner');

  await page.getByRole('link', { name: 'Logout' }).click();
  await page.getByRole('link', { name: 'Login' }).click();

  await page.getByRole('textbox', { name: 'Email address' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill('diner');
  await page.getByRole('button', { name: 'Login' }).click();

  await userLink.waitFor({ state: 'visible', timeout: 10000 });
  await userLink.click();

  await expect(page.getByRole('main')).toContainText('pizza dinerx');
});

test('listUsers', async ({ page }) => {
  const admin = {
    id: '1',
    name: 'Ada Admin',
    email: 'admin@jwt.com',
    roles: [{ role: 'admin' }],
  };
  const users = [
    admin,
    { id: '2', name: 'Kai Chen', email: 'kai@jwt.com', roles: [{ role: 'diner' }] },
    { id: '3', name: 'Fran Chisee', email: 'fran@jwt.com', roles: [{ role: 'franchisee' }] },
    ...Array.from({ length: 7 }, (_, index) => ({
      id: String(index + 4),
      name: `User ${index + 4}`,
      email: `user${index + 4}@jwt.com`,
      roles: [{ role: 'diner' }],
    })),
    { id: '11', name: 'Zoe Last', email: 'zoe@jwt.com', roles: [{ role: 'diner' }] },
  ];
  const userRequests: { page: string | null; limit: string | null; name: string | null }[] = [];

  await page.route('**/api/auth', async (route) => {
    await route.fulfill({ json: { user: admin, token: 'admin-token' } });
  });
  await page.route('**/api/user/me', async (route) => {
    await route.fulfill({ json: admin });
  });
  await page.route(/\/api\/user\?.*$/, async (route) => {
    const url = new URL(route.request().url());
    const query = {
      page: url.searchParams.get('page'),
      limit: url.searchParams.get('limit'),
      name: url.searchParams.get('name'),
    };
    userRequests.push(query);

    const filter = (query.name ?? '*').replace(/\*/g, '').toLowerCase();
    const filteredUsers = users.filter((user) => user.name.toLowerCase().includes(filter));
    const pageNumber = Number(query.page);
    const limit = Number(query.limit);
    const start = (pageNumber - 1) * limit;

    await route.fulfill({
      json: {
        users: filteredUsers.slice(start, start + limit),
        more: start + limit < filteredUsers.length,
      },
    });
  });
  await page.route(/\/api\/franchise(?:\?.*)?$/, async (route) => {
    await route.fulfill({ json: { franchises: [], more: false } });
  });

  await page.goto('/');
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill(admin.email);
  await page.getByRole('textbox', { name: 'Password' }).fill('admin-password');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.getByRole('link', { name: 'Admin' }).click();

  const usersTable = page.getByRole('table', { name: 'Users' });
  await expect(usersTable).toContainText('Ada Admin');
  await expect(usersTable).toContainText('admin@jwt.com');
  await expect(usersTable).toContainText('admin');
  await expect(usersTable).toContainText('Kai Chen');
  await expect(usersTable).toContainText('kai@jwt.com');
  await expect(usersTable).toContainText('diner');
  await expect(usersTable).toContainText('Fran Chisee');
  await expect(usersTable).toContainText('franchisee');
  await expect(usersTable.getByRole('button', { name: 'Previous users page' })).toBeDisabled();

  const nextPage = usersTable.getByRole('button', { name: 'Next users page' });
  await expect(nextPage).toBeEnabled();
  await nextPage.click();
  await expect(usersTable).toContainText('Zoe Last');
  await expect(usersTable).not.toContainText('Ada Admin');
  await expect(nextPage).toBeDisabled();
  await usersTable.getByRole('button', { name: 'Previous users page' }).click();
  await expect(usersTable).toContainText('Ada Admin');

  await page.getByRole('textbox', { name: 'Filter users by name' }).fill('Kai');
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(usersTable).toContainText('Kai Chen');
  await expect(usersTable).toContainText('kai@jwt.com');
  await expect(usersTable).not.toContainText('Ada Admin');
  await expect(usersTable).not.toContainText('Fran Chisee');

  expect(userRequests).toContainEqual({ page: '1', limit: '10', name: '*' });
  expect(userRequests).toContainEqual({ page: '2', limit: '10', name: '*' });
  expect(userRequests).toContainEqual({ page: '1', limit: '10', name: '*Kai*' });
});
