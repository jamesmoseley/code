import {test, expect } from '@playwright/test';
import { PDFParse } from 'pdf-parse';

test('Assert text from test PDF invoice', async ({ page }) => {
    // Using pdf-parse to fetch and parse the PDF content from random pdf test source
    const parser = new PDFParse({ url: 'https://slicedinvoices.com/pdf/wordpress-pdf-invoice-plugin-sample.pdf' });

    const result = await parser.getText();
    const orderRegex = /Order Number\s*(\d+)/;
    const match = result.text.match(orderRegex);
    expect(match).not.toBeNull();
    const orderNumber = match ? match[1] : null;
    expect(orderNumber).toBe('12345');
});