import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  getServerCustomers,
  getServerCustomerById,
  getServerCustomerByEmail,
  authenticateCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  updateCustomerPassword,
  manageCustomerAddress,
  manageCustomerWishlist,
} from '../../src/lib/server/customers-store.ts';

describe('Customer Store & RBAC Authorization Engine', () => {
  test('getServerCustomers returns sanitized profiles and calculates lifetime aggregates', () => {
    const customers = getServerCustomers();
    assert.ok(Array.isArray(customers));
    assert.ok(customers.length >= 1);

    const first = customers[0];
    assert.ok(first.id);
    assert.ok(first.email);
    assert.ok(first.fullName);
    assert.equal((first as any).passwordHash, undefined, 'passwordHash must never be exposed');
    assert.equal(typeof first.totalOrders, 'number');
    assert.equal(typeof first.lifetimeSpendInPaise, 'number');
  });

  test('authenticateCustomer validates credentials and rejects invalid or suspended accounts', () => {
    // 1. Valid customer authentication
    const authSuccess = authenticateCustomer('customer@infinicharm.com', 'Customer@1234!');
    assert.ok(authSuccess.customer);
    assert.equal(authSuccess.customer.email, 'customer@infinicharm.com');
    assert.equal((authSuccess.customer as any).passwordHash, undefined);

    // 2. Wrong password rejection
    const wrongPass = authenticateCustomer('customer@infinicharm.com', 'WrongPass123!');
    assert.equal(wrongPass.customer, null);
    assert.ok(wrongPass.error?.includes('password'));

    // 3. Non-existent customer
    const nonExistent = authenticateCustomer('nonexistent@example.com', 'Customer@1234!');
    assert.equal(nonExistent.customer, null);
    assert.ok(nonExistent.error?.includes('No account'));

    // 4. Suspended customer rejection (self-contained fixture)
    const tempEmail = `suspended.unit.${Date.now()}@example.com`;
    const createdTemp = createCustomer({
      email: tempEmail,
      password: 'Customer@1234!',
      fullName: 'Suspended Unit Fixture',
      phone: '9000011122',
    });
    assert.ok(createdTemp.id);
    try {
      updateCustomer(createdTemp.id, { status: 'SUSPENDED' });
      const suspended = authenticateCustomer(tempEmail, 'Customer@1234!');
      assert.equal(suspended.customer, null);
      assert.ok(suspended.error?.includes('suspended'));
    } finally {
      deleteCustomer(createdTemp.id);
    }
  });

  test('manageCustomerAddress manages multiple addresses and respects default shipping/billing', () => {
    const customerId = 'cust-01';

    // 1. Add new address
    const updatedAddrs = manageCustomerAddress(customerId, 'ADD', {
      fullName: 'AbdurRahman (Temporary Depot)',
      phone: '8825164657',
      addressLine1: 'Test Depot Street 12',
      city: 'Motihari',
      state: 'Bihar',
      postalCode: '845427',
      isDefaultShipping: false,
      isDefaultBilling: false,
    });

    assert.ok(updatedAddrs);
    const added = updatedAddrs.find((a) => a.fullName === 'AbdurRahman (Temporary Depot)');
    assert.ok(added);

    // 2. Set default shipping
    const withNewDefault = manageCustomerAddress(customerId, 'SET_DEFAULT_SHIPPING', {
      id: added.id,
    });
    assert.ok(withNewDefault);
    const newDef = withNewDefault.find((a) => a.id === added.id);
    assert.equal(newDef?.isDefaultShipping, true);

    // 3. Delete temporary address
    const afterDelete = manageCustomerAddress(customerId, 'DELETE', {
      id: added.id,
    });
    assert.ok(afterDelete);
    assert.equal(afterDelete.some((a) => a.id === added.id), false);
  });

  test('updateCustomerPassword verifies current password and enforces minimum length', () => {
    // Rejects short new password
    const shortRes = updateCustomerPassword('cust-01', 'Customer@1234!', '123');
    assert.equal(shortRes.success, false);
    assert.match(shortRes.error || '', /at least \d+ characters/i);

    // Rejects wrong current password
    const wrongRes = updateCustomerPassword('cust-01', 'IncorrectCurrentPassword', 'NewPassword123!');
    assert.equal(wrongRes.success, false);
    assert.ok(wrongRes.error?.includes('Current password'));
  });

  test('manageCustomerWishlist supports adding, removing, and toggling items', () => {
    const customerId = 'cust-01';
    const testProdId = 'prod-clothing-kurta-01';

    // Toggle add
    const list1 = manageCustomerWishlist(customerId, testProdId, 'ADD');
    assert.ok(list1.includes(testProdId));

    // Toggle remove
    const list2 = manageCustomerWishlist(customerId, testProdId, 'REMOVE');
    assert.ok(!list2.includes(testProdId));
  });

  test('Admin full CRUD: create, update, admin password reset, and permanent delete with order anonymization', () => {
    const testEmail = `admin-crud-test-${Date.now()}@example.com`;

    // 1. CREATE customer
    const created = createCustomer({
      fullName: 'CRUD Test User',
      email: testEmail,
      phone: '9988776655',
      password: 'InitialPassword123!',
      status: 'ACTIVE',
      role: 'CUSTOMER',
      notes: 'Initial admin audit note',
    });
    assert.ok(created.id);
    assert.equal(created.email, testEmail.toLowerCase());
    assert.equal(created.fullName, 'CRUD Test User');

    // 2. READ customer
    const fetched = getServerCustomerById(created.id);
    assert.ok(fetched);
    assert.equal(fetched.id, created.id);

    // 3. UPDATE customer (Full profile edit including admin password reset)
    const updated = updateCustomer(created.id, {
      fullName: 'CRUD Test User Updated',
      phone: '9988776600',
      status: 'SUSPENDED',
      role: 'CUSTOMER',
      notes: 'Account suspended by compliance',
      password: 'NewAdminSetPassword456!',
    });
    assert.ok(updated);
    assert.equal(updated.fullName, 'CRUD Test User Updated');
    assert.equal(updated.phone, '9988776600');
    assert.equal(updated.status, 'SUSPENDED');
    assert.equal(updated.notes, 'Account suspended by compliance');

    // 4. Test authenticate with new admin-set password (should fail because status is SUSPENDED)
    const authSuspended = authenticateCustomer(testEmail, 'NewAdminSetPassword456!');
    assert.equal(authSuspended.customer, null);
    assert.ok(authSuspended.error?.includes('suspended'));

    // Reactivate and verify authentication succeeds with new admin-set password
    updateCustomer(created.id, { status: 'ACTIVE' });
    const authActive = authenticateCustomer(testEmail, 'NewAdminSetPassword456!');
    assert.ok(authActive.customer);
    assert.equal(authActive.customer.fullName, 'CRUD Test User Updated');

    // 5. PERMANENT DELETE with cascading cleanup across orders, reviews, and profile
    const ordersFilePath = path.join(process.cwd(), 'src', 'data', 'orders.json');
    const reviewsFilePath = path.join(process.cwd(), 'src', 'data', 'reviews.json');

    // Create a temporary order and review linked to this customer before deletion
    const currentOrders = JSON.parse(fs.readFileSync(ordersFilePath, 'utf8'));
    const currentReviews = JSON.parse(fs.readFileSync(reviewsFilePath, 'utf8'));

    try {
      const dummyOrder = {
        id: `ord-test-delete-${Date.now()}`,
        orderNumber: `INF-TEST-${Date.now()}`,
        customerId: created.id,
        customerEmail: testEmail,
        status: 'CONFIRMED',
        totalInPaise: 240000,
        createdAt: new Date().toISOString(),
      };
      fs.writeFileSync(ordersFilePath, JSON.stringify([...currentOrders, dummyOrder], null, 2), 'utf8');

      const dummyReview = {
        id: `rev-test-delete-${Date.now()}`,
        productId: 'prod-01',
        customerId: created.id,
        customerEmail: testEmail,
        rating: 5,
        comment: 'Excellent harvest taste and fast delivery!',
        status: 'APPROVED',
        createdAt: new Date().toISOString(),
      };
      fs.writeFileSync(reviewsFilePath, JSON.stringify([...currentReviews, dummyReview], null, 2), 'utf8');

      // Execute permanent deletion
      const deleted = deleteCustomer(created.id);
      assert.equal(deleted, true);

      // Verify customer is permanently removed from database
      const postDelete = getServerCustomerById(created.id);
      assert.equal(postDelete, null);

      // Verify deleted user is permanently blocked from re-login
      const authPostDelete = authenticateCustomer(testEmail, 'NewAdminSetPassword456!');
      assert.equal(authPostDelete.customer, null);
      assert.ok(authPostDelete.error?.includes('No account'));

      // Verify cascading deletion: associated orders and reviews are permanently sanitized/erased
      const postDeleteOrders = JSON.parse(fs.readFileSync(ordersFilePath, 'utf8'));
      assert.equal(postDeleteOrders.some((o: any) => o.customerId === created.id || o.customerEmail === testEmail), false);

      const postDeleteReviews = JSON.parse(fs.readFileSync(reviewsFilePath, 'utf8'));
      assert.equal(postDeleteReviews.some((r: any) => r.customerId === created.id || r.customerEmail === testEmail), false);
    } finally {
      // Guaranteed clean restoration so dummy order and review never persist on disk
      fs.writeFileSync(ordersFilePath, JSON.stringify(currentOrders, null, 2), 'utf8');
      fs.writeFileSync(reviewsFilePath, JSON.stringify(currentReviews, null, 2), 'utf8');
    }
  });
});

