import { test } from '@playwright/test';

test('print node version', async () => {
  console.log('process.version =', process.version);
  console.log('process.execPath =', process.execPath);
});
