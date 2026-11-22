import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  createCustomer,
  deleteCustomer,
  autoSaveCustomerOrderDetails,
  manageCustomerAddress,
} from '../../src/lib/server/customers-store.ts';

describe('Customer Details Auto-Save & Address Book Management Suite', () => {
  test('autoSaveCustomerOrderDetails automatically saves address on first order and sets default', () => {
    const testEmail = `autosave.test.${Date.now()}@infinicharm.test`;
    const customer = createCustomer({
      email: testEmail,
      password: 'Customer@1234!',
      fullName: 'AutoSave User One',
      phone: '', // intentionally empty
    });
    assert.ok(customer.id);

    try {
      const result = autoSaveCustomerOrderDetails({
        customerId: customer.id,
        customerEmail: testEmail,
        customerName: 'AutoSave User One',
        customerPhone: '9876501234',
        shippingAddress: {
          fullName: 'AutoSave User One',
          phone: '9876501234',
          addressLine1: 'Flat 402, Royal Residency',
          addressLine2: 'Civil Lines',
          city: 'Motihari',
          state: 'Bihar',
          postalCode: '845401',
          country: 'India',
          type: 'HOME',
          label: 'Home Apartment',
        },
      });

      assert.ok(result.customer);
      assert.equal(result.customer.phone, '9876501234', 'Customer phone must be updated from order');
      assert.equal(result.customer.addresses?.length, 1, 'Address must be auto-saved');
      assert.equal(result.customer.addresses[0].isDefaultShipping, true, 'First address must be default shipping');
      assert.equal(result.customer.addresses[0].label, 'Home Apartment');
      assert.equal(result.customer.addresses[0].type, 'HOME');
      assert.equal(result.isNewAddress, true);
    } finally {
      deleteCustomer(customer.id);
    }
  });

  test('autoSaveCustomerOrderDetails saves multiple addresses without overwriting original', () => {
    const testEmail = `multisave.test.${Date.now()}@infinicharm.test`;
    const customer = createCustomer({
      email: testEmail,
      password: 'Customer@1234!',
      fullName: 'Multi Address User',
      phone: '9876511111',
    });

    try {
      // Order 1: Home Address
      const res1 = autoSaveCustomerOrderDetails({
        customerId: customer.id,
        customerEmail: testEmail,
        shippingAddress: {
          fullName: 'Multi Address User',
          phone: '9876511111',
          addressLine1: 'House 12, Gandhi Nagar',
          city: 'Motihari',
          state: 'Bihar',
          postalCode: '845401',
          type: 'HOME',
          label: 'My Home',
        },
      });
      assert.ok(res1.customer);
      assert.equal(res1.customer.addresses?.length, 1);
      const homeAddrId = res1.customer.addresses[0].id;

      // Order 2: Office Address
      const res2 = autoSaveCustomerOrderDetails({
        customerId: customer.id,
        customerEmail: testEmail,
        shippingAddress: {
          fullName: 'Multi Address User (Work)',
          phone: '9876522222',
          addressLine1: 'Tech Park, Floor 3, IT Complex',
          city: 'Patna',
          state: 'Bihar',
          postalCode: '800001',
          type: 'OFFICE',
          label: 'TechilyFly Office',
        },
      });

      assert.ok(res2.customer);
      assert.equal(res2.customer.addresses?.length, 2, 'Must have 2 separate addresses without overwriting');

      // Verify original address remained intact
      const homeAddr = res2.customer.addresses.find((a: any) => a.id === homeAddrId);
      assert.ok(homeAddr, 'Original address must not be lost');
      assert.equal(homeAddr.addressLine1, 'House 12, Gandhi Nagar');
      assert.equal(homeAddr.label, 'My Home');

      // Verify second address was created properly
      const officeAddr = res2.customer.addresses.find((a: any) => a.label === 'TechilyFly Office');
      assert.ok(officeAddr, 'New office address must exist');
      assert.equal(officeAddr.type, 'OFFICE');
      assert.equal(officeAddr.city, 'Patna');
      assert.equal(officeAddr.postalCode, '800001');
    } finally {
      deleteCustomer(customer.id);
    }
  });

  test('autoSaveCustomerOrderDetails updates existing address when identical line1 and postalCode submitted', () => {
    const testEmail = `dedup.test.${Date.now()}@infinicharm.test`;
    const customer = createCustomer({
      email: testEmail,
      password: 'Customer@1234!',
      fullName: 'Dedup User',
      phone: '9876533333',
    });

    try {
      autoSaveCustomerOrderDetails({
        customerId: customer.id,
        customerEmail: testEmail,
        shippingAddress: {
          fullName: 'Dedup User',
          phone: '9876533333',
          addressLine1: 'Main Market Road, Building A',
          addressLine2: 'Suite 1',
          city: 'Raxaul',
          state: 'Bihar',
          postalCode: '845305',
          type: 'HOME',
          label: 'Home',
        },
      });

      // Submit identical address again with updated suite/line2
      const afterSecond = autoSaveCustomerOrderDetails({
        customerId: customer.id,
        customerEmail: testEmail,
        shippingAddress: {
          fullName: 'Dedup User',
          phone: '9876533333',
          addressLine1: 'Main Market Road, Building A',
          addressLine2: 'Suite 2 (Updated)',
          city: 'Raxaul',
          state: 'Bihar',
          postalCode: '845305',
          type: 'HOME',
          label: 'Home Updated',
        },
      });

      assert.equal(afterSecond.customer?.addresses?.length, 1, 'Should update existing address and prevent duplicate pollution');
      assert.equal(afterSecond.customer?.addresses[0].addressLine2, 'Suite 2 (Updated)');
      assert.equal(afterSecond.customer?.addresses[0].label, 'Home Updated');
      assert.equal(afterSecond.isNewAddress, false);
    } finally {
      deleteCustomer(customer.id);
    }
  });

  test('manageCustomerAddress supports RENAME action and custom labels', () => {
    const testEmail = `rename.test.${Date.now()}@infinicharm.test`;
    const customer = createCustomer({
      email: testEmail,
      password: 'Customer@1234!',
      fullName: 'Rename Tester',
      phone: '9876544444',
    });

    try {
      const addrList = manageCustomerAddress(customer.id, 'ADD', {
        fullName: 'Rename Tester',
        phone: '9876544444',
        addressLine1: 'Bypass Road, Near Bus Stand',
        city: 'Chakia',
        state: 'Bihar',
        postalCode: '845412',
        type: 'OTHER',
        label: 'Old Warehouse',
      });

      assert.equal(addrList?.length, 1);
      const addrId = addrList[0].id;

      // Rename address
      const renamedList = manageCustomerAddress(customer.id, 'RENAME', {
        id: addrId,
        label: 'Central Distribution Hub',
        type: 'OFFICE',
      });

      assert.equal(renamedList?.length, 1);
      assert.equal(renamedList[0].label, 'Central Distribution Hub');
      assert.equal(renamedList[0].type, 'OFFICE');
    } finally {
      deleteCustomer(customer.id);
    }
  });
});
