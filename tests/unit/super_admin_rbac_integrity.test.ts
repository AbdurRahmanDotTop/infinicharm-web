import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  getServerCustomers,
  getServerCustomerById,
  isSuperAdminAccount,
  updateCustomer,
  deleteCustomer,
  bulkUpdateCustomers,
} from '../../src/lib/server/customers-store.ts';

describe('Super Admin Identity & Role Integrity Suite', () => {
  test('authoritative Super Admin account is usr-admin-01 with admin@infinicharm.com and SUPER_ADMIN role', () => {
    const adminUser = getServerCustomerById('usr-admin-01');
    assert.ok(adminUser, 'Super Admin account usr-admin-01 must exist');
    assert.equal(adminUser.email, 'admin@infinicharm.com');
    assert.equal(adminUser.role, 'SUPER_ADMIN');
    assert.equal(adminUser.status, 'ACTIVE');
    assert.equal(adminUser.emailVerified, true);
    assert.ok(Array.isArray(adminUser.permissions));
    assert.equal(adminUser.permissions?.length, 8, 'Super Admin must possess all 8 operational permissions');
    assert.equal(isSuperAdminAccount(adminUser), true);
  });

  test('AbdurRahman Ibn Ghufran (cust-founder-01) is strictly a CUSTOMER with zero administrative permissions', () => {
    const founderCustomer = getServerCustomerById('cust-founder-01');
    assert.ok(founderCustomer, 'Founder customer account cust-founder-01 must exist');
    assert.equal(founderCustomer.email, 'abdurrahmanibnghufran@gmail.com');
    assert.equal(founderCustomer.role, 'CUSTOMER', 'Founder personal account must strictly have CUSTOMER role');
    assert.equal(isSuperAdminAccount(founderCustomer), false, 'Founder personal account must NOT be flagged as Super Admin');
    assert.deepEqual(founderCustomer.permissions || [], [], 'Customer must have empty administrative permissions');
  });

  test('Super Administrator account cannot be suspended or demoted', () => {
    // Attempting suspension
    assert.throws(
      () => {
        updateCustomer('usr-admin-01', { status: 'SUSPENDED' });
      },
      /Protected Super Administrator account cannot be suspended or deactivated/i
    );

    // Attempting role demotion
    assert.throws(
      () => {
        updateCustomer('usr-admin-01', { role: 'CUSTOMER' });
      },
      /Protected Super Administrator account role cannot be changed/i
    );
  });

  test('Super Administrator account cannot be deleted', () => {
    assert.throws(
      () => {
        deleteCustomer('usr-admin-01');
      },
      /Protected Super Administrator and administrator accounts cannot be deleted/i
    );
  });

  test('Non-super admin users cannot be escalated to SUPER_ADMIN', () => {
    assert.throws(
      () => {
        updateCustomer('cust-01', { role: 'SUPER_ADMIN' });
      },
      /SUPER_ADMIN role is reserved exclusively/i
    );

    // In bulk updates, SUPER_ADMIN cannot be assigned
    const bulkRes = bulkUpdateCustomers(['cust-01'], { role: 'SUPER_ADMIN' });
    assert.equal(bulkRes.success, false);
    assert.ok(bulkRes.errors.some(e => e.includes('SUPER_ADMIN role cannot be assigned via bulk updates')));
  });

  test('getServerCustomers returns correct protected flag exclusively for Super Admin', () => {
    const all = getServerCustomers();
    const adminCust = all.find(c => c.id === 'usr-admin-01');
    assert.ok(adminCust);
    assert.equal(adminCust.isProtected, true);
    assert.equal(adminCust.role, 'SUPER_ADMIN');

    const regularCust = all.find(c => c.id === 'cust-founder-01');
    assert.ok(regularCust);
    assert.equal(regularCust.isProtected, false);
    assert.equal(regularCust.role, 'CUSTOMER');
  });
});
