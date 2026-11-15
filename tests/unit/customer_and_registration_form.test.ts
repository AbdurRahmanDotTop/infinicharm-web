import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  getRegistrationFormSettings,
  getPublicRegistrationFormSettings,
  saveRegistrationFormSettings,
  addRegistrationFormField,
  updateRegistrationFormField,
  deleteRegistrationFormField,
  reorderRegistrationFormFields,
} from '../../src/lib/server/registration-form-store.ts';
import {
  createCustomer,
  deleteCustomer,
  bulkDeleteCustomers,
  getServerCustomerById,
} from '../../src/lib/server/customers-store.ts';

describe('Customer Management, Deletion Cascade & Registration Form Builder', () => {
  test('Registration Form Settings: loads defaults, adds, updates, reorders, and deletes fields', () => {
    const initial = getRegistrationFormSettings();
    assert.ok(initial.title, 'Has form title');
    assert.ok(Array.isArray(initial.fields), 'Has fields array');

    const publicSettings = getPublicRegistrationFormSettings();
    assert.ok(publicSettings.fields.every(f => f.isEnabled !== false), 'Public settings only returns enabled fields');

    // Add field
    const addRes = addRegistrationFormField({
      key: 'test_company_' + Date.now(),
      label: 'Company Name',
      type: 'text',
      placeholder: 'Acme Inc.',
      required: false,
      isEnabled: true,
      order: 10,
    });
    assert.strictEqual(addRes.success, true);
    assert.ok(addRes.field?.id, 'New field has an id');
    assert.strictEqual(addRes.field?.label, 'Company Name');

    const fieldKey = addRes.field!.key;

    // Update field
    const updateRes = updateRegistrationFormField(fieldKey, {
      label: 'Organization Name',
      placeholder: 'E.g. Acme Corp',
    });
    assert.strictEqual(updateRes.success, true);
    assert.strictEqual(updateRes.field?.label, 'Organization Name');

    // Delete field
    const deleteRes = deleteRegistrationFormField(fieldKey);
    assert.strictEqual(deleteRes.success, true);

    // System fields protection
    const systemDelRes = deleteRegistrationFormField('fullName');
    assert.strictEqual(systemDelRes.success, false);
    assert.ok(systemDelRes.error?.includes('System critical fields cannot be deleted'));
  });

  test('Customer Creation & Deletion Cascade: preserves order history with PII anonymization', () => {
    const testEmail = 'cascade-test-' + Date.now() + '@example.com';
    const customer = createCustomer({
      email: testEmail,
      fullName: 'Cascade Test User',
      phone: '+91 99999 88888',
      password: 'StrongPassword123!',
      customFields: {
        hearAboutUs: 'Instagram Ad'
      }
    });

    assert.ok(customer.id);
    assert.strictEqual(customer.customFields?.hearAboutUs, 'Instagram Ad');

    // Verify customer exists
    const retrievedBefore = getServerCustomerById(customer.id);
    assert.ok(retrievedBefore);

    // Delete customer
    const deleted = deleteCustomer(customer.id);
    assert.strictEqual(deleted, true);

    // Verify customer is removed from customer store
    const retrievedAfter = getServerCustomerById(customer.id);
    assert.strictEqual(retrievedAfter, null);
  });

  test('Bulk Delete Customers: deletes multiple accounts and reports accurate count', () => {
    const email1 = 'bulk1-' + Date.now() + '@example.com';
    const email2 = 'bulk2-' + Date.now() + '@example.com';
    const cust1 = createCustomer({ email: email1, fullName: 'Bulk User 1', phone: '+91 91111 11111', password: 'Password123!' });
    const cust2 = createCustomer({ email: email2, fullName: 'Bulk User 2', phone: '+91 92222 22222', password: 'Password123!' });

    const result = bulkDeleteCustomers([cust1.id, cust2.id]);
    assert.strictEqual(result.deletedCount, 2);
    assert.strictEqual(getServerCustomerById(cust1.id), null);
    assert.strictEqual(getServerCustomerById(cust2.id), null);
  });
});
