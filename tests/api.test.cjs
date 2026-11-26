const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('app.js', 'utf8').split('// ================= Console, helpers =================')[0];

function client(fetch) {
  const context = { fetch, performance: { now: () => 10 }, Date, URLSearchParams, console,
    stat: () => ({ isFinal: false }), logCall() {} };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context.api;
}

test('loads and maps provider enquiry records with a mocked response', async () => {
  let requested;
  const api = client(async (url, options) => {
    requested = { url, options };
    return { ok: true, status: 200, json: async () => ({ result: true, data: [{ enquiryId: 42, customerName: 'Demo', customerEmail: 'demo@example.test', message: 'Need help', categoryId: 7, statusId: 9, enquiryDate: '2026-01-01T00:00:00Z' }] }) };
  });
  const result = await api('GET', 'get-enquiries', null, true);
  assert.equal(requested.url, 'https://api.freeprojectapi.com/api/Enquiry/get-enquiries');
  assert.equal(requested.options.method, 'GET');
  assert.equal(result.total, 1);
  assert.equal(result.data[0].id, '42');
  assert.equal(result.data[0].name, 'Demo');
  assert.equal(result.data[0].categoryId, '7');
  assert.equal(result.data[0].subject, 'Need help');
});

test('surfaces provider errors without attempting a write', async () => {
  const api = client(async () => ({ ok: false, status: 503, json: async () => ({ message: 'Unavailable' }) }));
  await assert.rejects(() => api('GET', 'get-categories', null, true), /Unavailable/);
});
