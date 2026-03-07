# AGENTS.md - Trading Journal Development Guide

## Project Overview

A Next.js 16 trading journal application using Supabase for authentication and database. Built with TypeScript, React 19, and Tailwind CSS v4.

## Build, Lint, and Test Commands

```bash
# Development
npm run dev              # Start Next.js development server (localhost:3000)

# Production
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint on the codebase

# No test framework is currently configured
```

## Code Style Guidelines

### TypeScript
- Strict mode is enabled in `tsconfig.json`
- Always use explicit types for function parameters and return types
- Use `import type` for type-only imports to improve performance

```typescript
// Good
import { supabase } from './supabase/client'
import type { TradeInsert, TradeUpdate } from './types'

// Bad
import { supabase, type TradeInsert } from './supabase/client'
```

### React/Next.js Conventions
- Use `'use client'` directive for client-side components
- Use functional components with TypeScript interfaces for props
- Name components using PascalCase
- Use file-based routing (App Router)

```typescript
interface TradeFormProps {
  trade?: Trade | null
  onClose: () => void
  onSuccess: () => void
  userId: string
}

export default function TradeForm({ trade, onClose, onSuccess, userId }: TradeFormProps) {
  // ...
}
```

### Naming Conventions
- Components: PascalCase (e.g., `TradeForm`, `TradeModal`)
- Functions/variables: camelCase (e.g., `getTrades`, `formData`)
- Types: PascalCase (e.g., `Trade`, `TradeInsert`, `System`, `SubSystem`)
- File names: kebab-case for non-components (e.g., `trade-form.tsx`, `trades.ts`)

### Imports Order
1. React/Next imports
2. External libraries (Supabase, etc.)
3. Internal imports (lib/, app/)
4. Type imports

```typescript
'use client'

import { useState, useEffect, useRef } from 'react'
import { createTrade, updateTrade } from '@/services/trade'
import { uploadScreenshot } from '@/services/upload'
import type { Trade, TradeInsert } from '@/services/trade'
```

### Path Aliases
Use `@/*` for absolute imports:
```typescript
import { getTrades } from '@/services/trade'
import { uploadScreenshot } from '@/services/upload'
import type { Trade } from '@/services/trade'
```

### Styling
- Use Tailwind CSS v4 utility classes
- Prefer semantic HTML elements
- Use `className` for Tailwind classes

### Error Handling
- Throw Supabase errors directly after operations
- Catch errors in async handlers and set error state
- Display user-friendly error messages in UI

```typescript
// In data access functions
if (error) throw error

// In event handlers
try {
  await createTrade(formData)
  onSuccess()
} catch (err) {
  setError(err instanceof Error ? err.message : 'Failed to save trade')
}
```

### State Management
- Use `useState` for local component state
- Use Context API for global state (see `lib/AuthContext.tsx`)
- Prefer functional updates: `setFormData(prev => ({ ...prev, field: value }))`

### Database/Supabase
- Define types in respective service's `types.ts` (e.g., `services/trade/types.ts`)
- Use `TradeInsert` and `TradeUpdate` types for create/update operations
- `trades` supports both `system_id` and `sub_system_id` assignments
- Always filter queries by `user_id` for multi-user support

### ESLint Configuration
- Uses `eslint-config-next` with TypeScript support
- Run `npm run lint` before committing

### Formatting
- Use single quotes for strings
- Use 2-space indentation
- Add trailing commas in objects and arrays
- Use semicolons at the end of statements

### General Patterns
- Place related functions in dedicated module files (e.g., `services/trade/trades.ts`)
- Use section comments for grouping code (optional)
- Initialize optional fields with `null` rather than `undefined`
- Use `URL.revokeObjectURL()` to clean up object URLs in useEffect cleanup

## Project Structure

```
/app              # Next.js App Router pages
  /backtesting    # Backtesting sessions + theoretical trades page
    ImportBacktestingTradesForm.tsx # Backtesting sheet import modal with mapping preview
  /trades         # Trades page and components
    CloseTradeForm.tsx # Quick close-trade modal form
    ImportTradesForm.tsx # Sheet/CSV import modal with mapping preview
  /systems        # Systems + sub-systems management page
  /login          # Login page
  /signup         # Signup page
  layout.tsx      # Root layout
  page.tsx        # Home page
/lib              # Shared client-side code
  /supabase       # Supabase client setup
  AuthContext.tsx # Authentication context
/services         # Backend logic (Supabase operations)
  /backtesting    # Backtesting sessions + theoretical trades CRUD
    index.ts      # Re-exports
    backtesting.ts # Backtesting data operations
    types.ts      # Backtesting types
  /trade          # Trade CRUD operations
    index.ts      # Re-exports
    trades.ts     # Trade CRUD functions
    types.ts      # Trade + screenshot types
  /system         # System CRUD operations
    index.ts      # Re-exports
    systems.ts    # System + sub-system CRUD functions
    types.ts      # System + sub-system types
  /upload         # File upload operations
    index.ts      # Re-exports
/supabase
  /migrations     # SQL migrations (systems, sub-systems, backtesting, schema updates)
```

## Common Tasks

### Adding a new trade field
1. Add field to `Trade` type in `services/trade/types.ts`
2. Add field to `TradeInsert` and/or `TradeUpdate` if needed
3. Update `TradeForm.tsx` to include the new field

### Adding a new sub-system field
1. Add field to `SubSystem` type in `services/system/types.ts`
2. Add field to `SubSystemInsert` and/or `SubSystemUpdate` if needed
3. Update `/app/systems/page.tsx` sub-system modal/form

### Assigning trade to system and sub-system
1. Ensure `system_id` and `sub_system_id` exist in `services/trade/types.ts`
2. Update `/app/trades/TradeForm.tsx` selection logic
3. Keep sub-system options filtered by selected system

### Merging systems
1. Use merge flow on `/app/systems/page.tsx` to select source and target systems
2. Reassign all source system trades to target system before deletion
3. Delete source system only after successful trade reassignment

### Adding close-trade flow (quick loss close)
1. Use `/app/trades/CloseTradeForm.tsx` for modal UI
2. Update `avg_exit`, `realised_loss`, and `r_multiple` via `updateTrade`
3. Wire modal open/close state from `/app/trades/page.tsx`

### Mirroring live trades into backtesting sessions
1. Use `/app/trades/TradeForm.tsx` to allow optional backtesting session selection when creating or editing live trades
2. Always save the live trade first, then mirror to `backtesting_trades` through `services/backtesting/backtesting.ts`
3. Match an existing mirror by `asset` + `entry_price` + `stop_loss`; if multiple matches exist, update the most recent one
4. If no mirror exists and a session is selected, create one with `outcome_r` defaulting to `0` when `r_multiple` is missing
5. Keep close/edit flows in sync by updating mirrored `outcome_r` after live-trade updates

### Updating dashboard stats filters
1. Keep `/app/trades/page.tsx` filters driven by selected `system_id` / `sub_system_id`
2. If checkboxes are selected, calculate stats from selected rows only
3. If no checkboxes are selected, calculate stats from currently filtered rows
4. Keep period R card totals in sync for: today, this week, this month, last 90 days, this year
5. Keep best/worst performer cards (system + asset) calculated from the same filtered/selected rows
6. Keep `EV / Trade` displayed in R (not dollars)

### Importing trades from sheets/files
1. Use `/app/trades/ImportTradesForm.tsx` for CSV/TSV/XLS/XLSX upload + mapping UI
2. Let users configure `rowsToSkip` and per-field column mappings with sample preview
3. Accept optional `trade_time` and `system_name` mappings during import
4. If `system_name` is mapped and system doesn't exist, create it with empty rules and assign `system_id`
5. Ignore non-data rows, log invalid rows in console with reason, and skip duplicate trades (existing + file-internal)
6. Support both separate date/time columns and combined date-time in one column (users can map both fields to same source column)
7. Keep `trade_date` mapping optional during import (default missing dates to today)

### Backtesting sessions and theoretical trades
1. Use `/app/backtesting/page.tsx` for session management and theoretical trade journaling
2. Backtesting sessions can link to existing `system_id` or create a new system during session creation
3. Backtesting trades store theoretical results in `outcome_r` (Profit in R), not realized dollar PnL
4. Use `/app/backtesting/ImportBacktestingTradesForm.tsx` for bulk importing theoretical trades with mapping and preview
5. Keep `trade_date` mapping optional during backtesting import (default missing dates to today)

### Creating a new page
1. Create directory in `/app` (e.g., `/app/analytics`)
2. Create `page.tsx` in the new directory
3. Use appropriate layout (or create custom)

### Running the app locally
```bash
npm run dev
```

Then visit http://localhost:3000
