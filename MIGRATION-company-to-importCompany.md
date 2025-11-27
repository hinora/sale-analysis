# Field Rename: company → importCompany

## Summary

Successfully renamed the `company` field to `importCompany` throughout the codebase to provide better clarity that this field refers to the importing company (not exporting company).

## Changes Made

### 1. Database Model (`Transaction.ts`)
- **Interface**: Renamed `company` to `importCompany` in `ITransaction` interface
- **Schema**: Renamed `company` field to `importCompany` in `TransactionSchema`
- **Comment**: Updated comment to clarify "Reference to Company (importer)"

### 2. API Data Formatting (`feed-data.ts`)
- **Query Building**: Changed filter from `query.company` to `query.importCompany`
- **Populate**: Changed `.populate("company", ...)` to `.populate("importCompany", ...)`
- **Formatted Data**: Renamed `companyName` to `importCompanyName` in transaction formatting

### 3. AI Query Handler (`query-handler.ts`)
- **Field References**: Updated all references from `companyName` to `importCompanyName`
- **Prompts**: Updated Vietnamese AI prompts with new field name
- **Validation**: Updated validation arrays to use `importCompanyName`
- **Fallback Logic**: Updated pattern matching to use `importCompanyName`
- **Examples**: Updated all examples in AI prompts

### 4. Aggregation Engine (`aggregation-engine.ts`)
- **Cache Interface**: Renamed `byCompany` to `byImportCompany` in `AggregationCache`
- **Cache Building**: Updated field name in `buildAggregationCache` function
- **Cache Queries**: Updated `queryCacheTopN` function signature and logic

### 5. Database Indexes (`indexes.ts`)
- **Index Creation**: Changed from `{ company: 1, date: -1 }` to `{ importCompany: 1, date: -1 }`
- **Index Validation**: Updated required index name from `company_1_date_-1` to `importCompany_1_date_-1`

### 6. API Endpoints

#### `companies/[id].ts`
- Transaction query: `{ company: id }` → `{ importCompany: id }`
- Aggregation match: `company: new Types.ObjectId(id)` → `importCompany: new Types.ObjectId(id)`

#### `companies/list.ts`
- Group stage: `_id: "$company"` → `_id: "$importCompany"`

#### `transactions/list.ts`
- Lookup stage: `localField: "company"` → `localField: "importCompany"`

#### `import/upload.ts`
- Transaction creation: `company: company.id` → `importCompany: company.id`
- Populate call: `.populate("company", "name")` → `.populate("importCompany", "name")`
- Field access: `t.company` → `t.importCompany`

#### `goods/[id].ts`
- Populate call: `.populate("company", ...)` → `.populate("importCompany", ...)`
- Field access: `tx.company` → `tx.importCompany`

### 7. Test Files

#### `filter-engine.test.ts`
- All test data: `companyName` → `importCompanyName`
- All filter fields: `companyName` → `importCompanyName`

#### `aggregation-engine.test.ts`
- Test data: `companyName` → `importCompanyName`
- Cache assertions: `cache.byCompany` → `cache.byImportCompany`
- Query function calls: `queryCacheTopN(cache, "company", n)` → `queryCacheTopN(cache, "importCompany", n)`

#### `query-handler.test.ts`
- Test data: `companyName` → `importCompanyName`

## Migration Required

A migration script has been created at `scripts/migrate-company-to-importCompany.ts` to:

1. Rename the `company` field to `importCompany` in all existing Transaction documents
2. Drop the old index `company_1_date_-1`
3. Create the new index `importCompany_1_date_-1`
4. Verify the migration completed successfully

### Running the Migration

```bash
npx tsx scripts/migrate-company-to-importCompany.ts
```

**⚠️ IMPORTANT**: Run this migration script before deploying the updated code to production.

## Files Modified

**Core Application**:
- `src/lib/db/models/Transaction.ts`
- `src/lib/db/indexes.ts`
- `src/lib/ai/query-handler.ts`
- `src/lib/ai/aggregation-engine.ts`
- `src/pages/api/ai/feed-data.ts`
- `src/pages/api/companies/[id].ts`
- `src/pages/api/companies/list.ts`
- `src/pages/api/transactions/list.ts`
- `src/pages/api/import/upload.ts`
- `src/pages/api/goods/[id].ts`

**Tests**:
- `tests/unit/filter-engine.test.ts`
- `tests/unit/aggregation-engine.test.ts`
- `tests/integration/query-handler.test.ts`

**New Files**:
- `scripts/migrate-company-to-importCompany.ts` (migration script)

## Frontend Impact

**No changes required** for frontend components. The following files use "company" as:
- Query parameters (user-facing filters)
- Display labels
- UI state variables

These are independent of the database field name and remain unchanged:
- `src/pages/transactions.tsx`
- `src/pages/goods.tsx`
- `src/pages/companies.tsx`
- `src/pages/ai-analysis.tsx`

## Verification Steps

1. ✅ Run TypeScript compiler: `npx tsc --noEmit`
2. ✅ Run unit tests: `npm test`
3. ✅ Run migration script in staging environment
4. ✅ Verify AI queries work with new field name
5. ✅ Verify transaction import works
6. ✅ Verify company detail pages load correctly

## Rollback Plan

If issues arise:

1. Revert code changes: `git revert <commit-hash>`
2. Run reverse migration:
```javascript
db.transactions.updateMany(
  { importCompany: { $exists: true } },
  { $rename: { importCompany: "company" } }
)
```
3. Restore old index:
```javascript
db.transactions.createIndex({ company: 1, date: -1 })
db.transactions.dropIndex("importCompany_1_date_-1")
```

## Related Documentation

- Data Model: `specs/001-export-goods-analysis/data-model.md`
- API Contracts: `specs/001-export-goods-analysis/contracts/*.yaml`

## Testing Recommendations

1. Test AI queries that reference companies
2. Test company filter in transactions page
3. Test company detail page with aggregations
4. Test CSV import with company data
5. Test aggregation cache building
