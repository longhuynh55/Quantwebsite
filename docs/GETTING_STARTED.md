# Getting Started Guide

This guide will help you set up the QuantVN platform from scratch, configure your data, and start analyzing the Vietnamese stock market.

## Table of Contents

1. [Environment Setup](#environment-setup)
2. [Data Requirements](#data-requirements)
3. [Configuration](#configuration)
4. [Running the Application](#running-the-application)
5. [Development Workflow](#development-workflow)
6. [Common Issues and Solutions](#common-issues-and-solutions)

---

## Environment Setup

### System Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| Node.js | 18.17.0 | 20.x LTS |
| npm | 9.0.0 | 10.x |
| RAM | 4 GB | 8 GB+ |
| Disk Space | 500 MB | 1 GB+ |

### Installing Node.js

**Windows:**
1. Download the installer from [nodejs.org](https://nodejs.org/)
2. Run the installer and follow the prompts
3. Verify installation:
   ```bash
   node --version
   npm --version
   ```

**Using nvm (Node Version Manager):**
```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install Node.js
nvm install 20
nvm use 20
```

### Installing Dependencies

```bash
# Navigate to project directory
cd quant-website

# Install dependencies
npm install

# Verify installation
npm list --depth=0
```

---

## Data Requirements

The application reads CSV files from `public/data/` (or `DATA_DIR` if set). Preferred runtime files are the prepared 2018-2025 datasets; 2020-2025 fallbacks are supported.

### Recommended: Prepare Runtime Data (2018-2025)

If you have raw files in `../data`, generate the runtime files:

```bash
npm run data:prepare:2018_2025
```

### File 1: Stock Metadata (`stock_metadata_2018_2025.csv`, fallback: `HOSE_VERIFIED_2020_2025.csv`)

This file contains metadata about each stock listed on HOSE.

**Required Columns:**

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| symbol | string | Stock ticker symbol | `VNM` |
| exchange | string | Exchange name | `HOSE` |
| status | string | Listing status | `ACTIVE` |
| data_rows_2018_2025 | number | Number of OHLCV rows (fallback file uses `data_rows_2020_2025`) | `1999` |
| source | string | Data source identifier | `derived_ohlcv_2018_2025` |
| first_date | date | First available trading date | `2018-01-02` |
| last_date | date | Last available trading date | `2025-12-31` |
| total_trading_days | number | Total trading days in period | `1999` |
| avg_volume | number | Average daily trading volume | `1500000` |
| listing_phase | string | Listing phase category | `FULL_PERIOD` |
| organ_name | string | Optional company name | `Example Corp` |
| icb_name4 | string | Optional industry name (level 4) | `Banks` |

**Example CSV:**
```csv
symbol,exchange,status,data_rows_2018_2025,source,first_date,last_date,total_trading_days,avg_volume,listing_phase,organ_name,icb_name4
VNM,HOSE,ACTIVE,1999,derived_ohlcv_2018_2025,2018-01-02,2025-12-31,1999,1500000,FULL_PERIOD,,Food
FPT,HOSE,ACTIVE,1999,derived_ohlcv_2018_2025,2018-01-02,2025-12-31,1999,800000,FULL_PERIOD,,Software
```

### File 2: OHLCV Data (`ohlcv_2018_2025.csv`, fallback: `ohlcv_enriched.csv`)

This file contains daily Open, High, Low, Close, Volume data for all stocks.

**Required Columns:**

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| symbol | string | Stock ticker symbol (case-insensitive) | `VNM` |
| date | date | Trading date | `2024-01-15` |
| open | number | Opening price | `85000` |
| high | number | Highest price of day | `86500` |
| low | number | Lowest price of day | `84000` |
| close | number | Closing price | `85500` |
| volume | number | Trading volume | `1500000` |

**Date Format:** `YYYY-MM-DD` or `DD/MM/YYYY`

**Example CSV:**
```csv
symbol,date,open,high,low,close,volume
VNM,2024-01-02,84000,85500,83500,85000,1200000
VNM,2024-01-03,85000,86500,84800,85500,1500000
VNM,2024-01-04,85500,86000,84500,85000,1100000
FPT,2024-01-02,120000,122000,119500,121500,800000
FPT,2024-01-03,121500,123000,120500,122000,750000
```

**Important Notes:**
- Data should be sorted by symbol and date (ascending)
- All prices should be in the same currency (VND)
- Volume is the number of shares traded
- Missing data should be handled before loading

### File 3: Market Index Data (`Market_Indices_Daily_2020_2025.csv`)

This file contains daily market index data (e.g., VN-Index).

**Required Columns:**

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| date | date | Trading date | `2024-01-15` |
| open | number | Index opening value | `1150.50` |
| high | number | Index high | `1160.25` |
| low | number | Index low | `1145.00` |
| close | number | Index closing value | `1155.75` |
| volume | number | Total market volume | `500000000` |
| symbol | string | Index symbol | `VNINDEX` |

**Example CSV:**
```csv
date,open,high,low,close,volume,symbol
2024-01-02,1140.00,1150.50,1138.25,1148.75,450000000,VNINDEX
2024-01-03,1148.75,1162.00,1145.50,1155.75,500000000,VNINDEX
2024-01-04,1155.75,1158.00,1140.25,1142.50,480000000,VNINDEX
```

### Optional: Quarterly Fundamentals (2018-2025)

If these files exist in `public/data/`, the app exposes `GET /api/fundamentals`:
- `HOSE_VERIFIED_BalanceSheet_Quarterly_2018_2025.csv`
- `HOSE_VERIFIED_IncomeStatement_Quarterly_2018_2025.csv`
- `HOSE_VERIFIED_CashFlow_Quarterly_2018_2025.csv`

### Data File Placement

Place your CSV files in the following location:
```
quant-website/
`-- public/
    `-- data/
        |-- stock_metadata_2018_2025.csv        (preferred)
        |-- ohlcv_2018_2025.csv                 (preferred)
        |-- Market_Indices_Daily_2020_2025.csv
        |-- HOSE_VERIFIED_BalanceSheet_Quarterly_2018_2025.csv    (optional)
        |-- HOSE_VERIFIED_IncomeStatement_Quarterly_2018_2025.csv (optional)
        |-- HOSE_VERIFIED_CashFlow_Quarterly_2018_2025.csv        (optional)
        |-- HOSE_VERIFIED_2020_2025.csv          (fallback)
        `-- ohlcv_enriched.csv                   (fallback)
```

Create the directory if it doesn't exist:
```bash
mkdir -p public/data
```

---

## Configuration

### Environment Variables

Create a `.env.local` file in the project root for any environment-specific configuration:

```env
# Optional: Custom port (default: 3000)
PORT=3000

# Optional: Override data directory (default: ./public/data)
DATA_DIR=public/data

# Optional: Enable development features
NEXT_PUBLIC_DEV_MODE=true
```

### Next.js Configuration

The `next.config.ts` file contains framework configuration:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Add custom configuration here
  reactStrictMode: true,
};

export default nextConfig;
```

### TypeScript Configuration

The project uses TypeScript with strict mode enabled. Key settings in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### Tailwind CSS Configuration

Styling is configured via Tailwind CSS 4. The configuration is in `postcss.config.mjs`.

---

## Running the Application

### Development Mode

Start the development server with hot-reload:

```bash
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

### Production Build

Build and run for production:

```bash
# Build the application
npm run build

# Start the production server
npm run start
```

### Linting

Run ESLint to check code quality:

```bash
npm run lint
```

---

## Development Workflow

### Recommended VS Code Extensions

1. **ESLint** - JavaScript/TypeScript linting
2. **Prettier** - Code formatting
3. **Tailwind CSS IntelliSense** - CSS class autocomplete
4. **TypeScript Importer** - Auto import suggestions

### Project Architecture

```
Request Flow:
Browser -> Next.js Page -> API Route -> lib/data.ts -> CSV Files
                                              |
                                              v
                                         lib/quant/* (calculations)
                                              |
                                              v
                                         Response to Browser
```

### Adding a New Feature

1. **Create the page** in `src/app/<feature>/page.tsx`
2. **Create API route** (if needed) in `src/app/api/<feature>/route.ts`
3. **Add calculation logic** in `src/lib/quant/<feature>.ts`
4. **Export from index** in `src/lib/quant/index.ts`
5. **Add UI components** in `src/components/`

### Code Style Guidelines

- Use TypeScript for all new files
- Follow the existing component patterns
- Use Tailwind CSS for styling
- Keep components small and focused
- Write descriptive commit messages

---

## Common Issues and Solutions

### Issue: "Data file not found" Error

**Symptoms:**
- API returns empty data
- Console shows "Stock metadata file not found"

**Solution:**
1. Verify files exist in `public/data/`
2. Check file names match exactly (case-sensitive)
3. Ensure CSV files have valid content

```bash
# Check files exist
ls -la public/data/

# Verify file content
head -5 public/data/stock_metadata_2018_2025.csv
head -5 public/data/ohlcv_2018_2025.csv
```

### Issue: "Module not found" Error

**Symptoms:**
- Build fails with module resolution errors
- Import statements show red underlines

**Solution:**
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Issue: Slow Data Loading

**Symptoms:**
- Initial page load takes >10 seconds
- API responses are slow

**Solution:**
1. Prefer prepared runtime files: `npm run data:prepare:2018_2025`
2. Consider implementing data pagination
3. Check available system memory

### Issue: Charts Not Rendering

**Symptoms:**
- Chart area is blank
- No errors in console

**Solution:**
1. Verify data format matches expected schema
2. Check browser console for warnings
3. Ensure data array is not empty

### Issue: TypeScript Errors

**Symptoms:**
- Build fails with type errors
- IDE shows red underlines

**Solution:**
```bash
# Check TypeScript errors
npx tsc --noEmit

# Regenerate type definitions
npm run build
```

### Issue: Port 3000 Already in Use

**Symptoms:**
- "Port 3000 is already in use" error

**Solution:**
```bash
# Use a different port
PORT=3001 npm run dev

# Or kill the process using port 3000
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac
lsof -i :3000
kill -9 <PID>
```

### Issue: Build Memory Error

**Symptoms:**
- Build fails with "JavaScript heap out of memory"

**Solution:**
```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm run build
```

---

## Next Steps

After setting up the application:

1. **Explore the Dashboard** - View market overview and top movers
2. **Use the Stock Screener** - Filter stocks by various criteria
3. **Run a Backtest** - Test a trading strategy on historical data
4. **Analyze Risk** - Calculate risk metrics for your portfolio
5. **Learn** - Go through the educational content

For more information, refer to:
- [README.md](../README.md) - Project overview
- [API Documentation](./API.md) - API endpoint reference
- [Quant Library Documentation](./QUANT_LIB.md) - Quantitative functions reference

---

## Getting Help

If you encounter issues not covered in this guide:

1. Check the browser console for errors
2. Review the server logs
3. Search existing issues in the repository
4. Create a new issue with:
   - Steps to reproduce
   - Expected behavior
   - Actual behavior
   - Environment details (OS, Node version, browser)
