import { Transaction } from './models/Transaction';

/**
 * Create compound indexes for Transaction model
 * These indexes optimize common query patterns per the data model specification
 */
export async function createTransactionIndexes(): Promise<void> {
  try {
    // Compound index: company + date (for company transactions sorted by date)
    await Transaction.collection.createIndex({ company: 1, date: -1 });
    console.log('[Indexes] Created compound index: { company: 1, date: -1 }');

    // Compound index: goods + date (for goods transactions sorted by date)
    await Transaction.collection.createIndex({ goods: 1, date: -1 });
    console.log('[Indexes] Created compound index: { goods: 1, date: -1 }');

    // Compound index: date + totalValueUSD (for sorting by date and value)
    await Transaction.collection.createIndex({ date: -1, totalValueUSD: -1 });
    console.log('[Indexes] Created compound index: { date: -1, totalValueUSD: -1 }');

    // Compound index: hsCode + date (for HS code transactions by date)
    await Transaction.collection.createIndex({ hsCode: 1, date: -1 });
    console.log('[Indexes] Created compound index: { hsCode: 1, date: -1 }');

    // Compound index: customsOffice + date (for customs office queries)
    await Transaction.collection.createIndex({ customsOffice: 1, date: -1 });
    console.log('[Indexes] Created compound index: { customsOffice: 1, date: -1 }');

    console.log('[Indexes] All compound indexes created successfully');
  } catch (error) {
    console.error('[Indexes] Error creating compound indexes:', error);
    throw error;
  }
}

/**
 * Verify that all expected indexes exist
 */
export async function verifyTransactionIndexes(): Promise<boolean> {
  try {
    const indexes = await Transaction.collection.getIndexes();
    console.log('[Indexes] Existing Transaction indexes:', Object.keys(indexes));

    const requiredIndexes = [
      'company_1_date_-1',
      'goods_1_date_-1',
      'date_-1_totalValueUSD_-1',
      'hsCode_1_date_-1',
      'customsOffice_1_date_-1',
    ];

    for (const indexName of requiredIndexes) {
      if (!(indexName in indexes)) {
        console.warn(`[Indexes] Missing required index: ${indexName}`);
        return false;
      }
    }

    console.log('[Indexes] All required indexes verified');
    return true;
  } catch (error) {
    console.error('[Indexes] Error verifying indexes:', error);
    return false;
  }
}
