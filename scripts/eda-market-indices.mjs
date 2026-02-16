/**
 * Exploratory Data Analysis for Market Indices Data
 * File: Market_Indices_Daily_2020_2025.csv
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CSV_PATH = path.join(__dirname, '../data/Market_Indices_Daily_2020_2025.csv');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function colorize(color, text) {
  return `${colors[color]}${text}${colors.reset}`;
}

function printHeader(title) {
  console.log('\n' + '='.repeat(80));
  console.log(colorize('bright', colorize('cyan', ` ${title} `)));
  console.log('='.repeat(80));
}

function printSubheader(title) {
  console.log('\n' + colorize('bright', colorize('yellow', `${title}`)));
  console.log('-'.repeat(80));
}

// Parse CSV file
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  const data = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx]?.trim();
    });
    data.push(row);
  }

  return { headers, data };
}

// Calculate statistics
function calculateStats(values) {
  const nums = values.filter(v => v !== null && v !== undefined && v !== '' && !isNaN(parseFloat(v)))
                      .map(v => parseFloat(v));

  if (nums.length === 0) return null;

  nums.sort((a, b) => a - b);
  const n = nums.length;
  const sum = nums.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  const variance = nums.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / n;
  const std = Math.sqrt(variance);

  return {
    count: n,
    min: nums[0],
    max: nums[n - 1],
    mean,
    median: n % 2 === 0 ? (nums[n/2 - 1] + nums[n/2]) / 2 : nums[Math.floor(n/2)],
    std,
    q1: nums[Math.floor(n * 0.25)],
    q3: nums[Math.floor(n * 0.75)]
  };
}

// Calculate returns and volatility
function calculateReturns(prices) {
  const returns = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i] && prices[i-1] && prices[i-1] !== 0) {
      returns.push((prices[i] - prices[i-1]) / prices[i-1]);
    }
  }
  return returns;
}

// Main EDA function
async function performEDA() {
  printHeader('EXPLORATORY DATA ANALYSIS - Market Indices Daily Data');
  console.log(colorize('cyan', `File: ${CSV_PATH}`));

  // 1. Data Overview
  printHeader('1. DATA OVERVIEW');
  const { headers, data } = parseCSV(CSV_PATH);

  console.log(colorize('green', `\nShape:`));
  console.log(`  Rows: ${colorize('bright', data.length.toLocaleString())}`);
  console.log(`  Columns: ${colorize('bright', headers.length)}`);

  console.log(colorize('green', `\nColumns:`));
  headers.forEach((h, i) => {
    const sample = data[0]?.[h] || '';
    console.log(`  ${i + 1}. ${colorize('bright', h.padEnd(10))} - Sample: "${sample}"`);
  });

  // Estimate memory usage
  const avgRowSize = JSON.stringify(data[0]).length;
  const estimatedMemory = (avgRowSize * data.length) / (1024 * 1024);
  console.log(colorize('green', `\nEstimated Memory Usage:`));
  console.log(`  ~${estimatedMemory.toFixed(2)} MB`);

  // 2. Data Quality
  printHeader('2. DATA QUALITY');

  console.log(colorize('green', '\nMissing Values Analysis:'));
  const missingAnalysis = {};
  headers.forEach(header => {
    const missing = data.filter(row => !row[header] || row[header] === '').length;
    const percentage = ((missing / data.length) * 100).toFixed(2);
    missingAnalysis[header] = { count: missing, percentage };
    const color = missing > 0 ? 'red' : 'green';
    console.log(`  ${colorize(color, header.padEnd(10))}: ${missing.toLocaleString()} (${percentage}%)`);
  });

  console.log(colorize('green', '\nDuplicate Rows:'));
  const seen = new Set();
  let duplicates = 0;
  data.forEach(row => {
    const key = JSON.stringify(row);
    if (seen.has(key)) duplicates++;
    seen.add(key);
  });
  console.log(`  ${colorize(duplicates > 0 ? 'red' : 'green', duplicates.toLocaleString())} duplicate rows found`);

  console.log(colorize('green', '\nInvalid Values Check:'));
  headers.forEach(header => {
    if (['open', 'high', 'low', 'close', 'volume'].includes(header)) {
      const invalid = data.filter(row => {
        const val = parseFloat(row[header]);
        return isNaN(val) || val < 0;
      }).length;
      if (invalid > 0) {
        console.log(`  ${colorize('red', header)}: ${invalid.toLocaleString()} invalid (negative/NaN) values`);
      } else {
        console.log(`  ${colorize('green', header)}: All values valid`);
      }
    }
  });

  // 3. Index Analysis
  printHeader('3. INDEX ANALYSIS');

  const indices = [...new Set(data.map(row => row.symbol))].sort();
  console.log(colorize('green', `\nFound ${colorize('bright', indices.length)} indices:`));
  indices.forEach((idx, i) => {
    const indexData = data.filter(row => row.symbol === idx);
    console.log(`  ${i + 1}. ${colorize('bright', idx.padEnd(10))} - ${indexData.length.toLocaleString()} records`);
  });

  // 4. Statistical Summary
  printHeader('4. STATISTICAL SUMMARY');

  const numericColumns = ['open', 'high', 'low', 'close', 'volume'];
  numericColumns.forEach(col => {
    printSubheader(`Statistics for ${col.toUpperCase()}`);
    console.log(`  ${'Metric'.padEnd(12)} | ${'Value'.padEnd(20)} | ${'Value'.padEnd(20)}`);
    console.log(`  ${'-'.repeat(12)}-+-${'-'.repeat(20)}-+-${'-'.repeat(20)}`);

    // Overall stats
    const allValues = data.map(row => parseFloat(row[col])).filter(v => !isNaN(v));
    const overallStats = calculateStats(allValues);

    if (overallStats) {
      console.log(`  ${'Count'.padEnd(12)} | ${overallStats.count.toLocaleString().padEnd(20)}`);
      console.log(`  ${'Mean'.padEnd(12)} | ${overallStats.mean.toFixed(2).padEnd(20)}`);
      console.log(`  ${'Std Dev'.padEnd(12)} | ${overallStats.std.toFixed(2).padEnd(20)}`);
      console.log(`  ${'Min'.padEnd(12)} | ${overallStats.min.toFixed(2).padEnd(20)}`);
      console.log(`  ${'Max'.padEnd(12)} | ${overallStats.max.toFixed(2).padEnd(20)}`);
      console.log(`  ${'Median'.padEnd(12)} | ${overallStats.median.toFixed(2).padEnd(20)}`);
      console.log(`  ${'Q1 (25%)'.padEnd(12)} | ${overallStats.q1.toFixed(2).padEnd(20)}`);
      console.log(`  ${'Q3 (75%)'.padEnd(12)} | ${overallStats.q3.toFixed(2).padEnd(20)}`);
    }

    // Per-index stats for close price
    if (col === 'close') {
      console.log(`\n  ${colorize('cyan', 'By Index:')}`);
      indices.forEach(idx => {
        const indexData = data.filter(row => row.symbol === idx);
        const indexValues = indexData.map(row => parseFloat(row.close)).filter(v => !isNaN(v));
        const stats = calculateStats(indexValues);
        if (stats) {
          console.log(`    ${idx.padEnd(10)}: mean=${stats.mean.toFixed(2)}, std=${stats.std.toFixed(2)}, min=${stats.min.toFixed(2)}, max=${stats.max.toFixed(2)}`);
        }
      });
    }
  });

  // 5. Temporal Analysis
  printHeader('5. TEMPORAL ANALYSIS');

  const dates = data.map(row => new Date(row.time)).filter(d => !isNaN(d));
  dates.sort((a, b) => a - b);

  console.log(colorize('green', '\nDate Range:'));
  console.log(`  Start: ${colorize('bright', dates[0].toISOString().split('T')[0])}`);
  console.log(`  End:   ${colorize('bright', dates[dates.length - 1].toISOString().split('T')[0])}`);

  const daysDiff = Math.ceil((dates[dates.length - 1] - dates[0]) / (1000 * 60 * 60 * 24));
  console.log(`  Span:  ${colorize('bright', daysDiff.toLocaleString())} days`);

  console.log(colorize('green', '\nData Coverage by Index:'));
  indices.forEach(idx => {
    const indexData = data.filter(row => row.symbol === idx).sort((a, b) => new Date(a.time) - new Date(b.time));
    const idxDates = indexData.map(row => new Date(row.time)).filter(d => !isNaN(d)).sort((a, b) => a - b);

    if (idxDates.length > 0) {
      const firstDate = idxDates[0].toISOString().split('T')[0];
      const lastDate = idxDates[idxDates.length - 1].toISOString().split('T')[0];
      const expectedDays = Math.ceil((idxDates[idxDates.length - 1] - idxDates[0]) / (1000 * 60 * 60 * 24)) + 1;
      const coverage = ((idxDates.length / expectedDays) * 100).toFixed(1);

      console.log(`  ${colorize('bright', idx.padEnd(10))}: ${firstDate} to ${lastDate} (${idxDates.length.toLocaleString()} records, ~${coverage}% coverage)`);
    }
  });

  // 6. Performance Metrics (Returns & Volatility)
  printHeader('6. PERFORMANCE ANALYSIS');

  console.log(colorize('green', '\nReturns & Volatility by Index:'));
  console.log(`  ${'Index'.padEnd(12)} | ${'Records'.padEnd(10)} | ${'Mean Daily Return'.padEnd(18)} | ${'Volatility (Std)'.padEnd(18)} | ${'Total Return'.padEnd(15)}`);
  console.log(`  ${'-'.repeat(12)}-+-${'-'.repeat(10)}-+-${'-'.repeat(18)}-+-${'-'.repeat(18)}-+-${'-'.repeat(15)}`);

  indices.forEach(idx => {
    const indexData = data.filter(row => row.symbol === idx).sort((a, b) => new Date(a.time) - new Date(b.time));
    const prices = indexData.map(row => parseFloat(row.close)).filter(v => !isNaN(v));
    const returns = calculateReturns(prices);

    if (returns.length > 0) {
      const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
      const stdReturn = Math.sqrt(returns.reduce((acc, r) => acc + Math.pow(r - meanReturn, 2), 0) / returns.length);
      const totalReturn = (prices[prices.length - 1] - prices[0]) / prices[0];

      console.log(`  ${idx.padEnd(12)} | ${returns.length.toLocaleString().padEnd(10)} | ${(meanReturn * 100).toFixed(4) + '%'.padEnd(15)} | ${(stdReturn * 100).toFixed(4) + '%'.padEnd(15)} | ${(totalReturn * 100).toFixed(2) + '%'}`);
    }
  });

  // 7. Correlation Analysis (Close prices)
  printHeader('7. CORRELATION ANALYSIS');

  if (indices.length > 1) {
    console.log(colorize('green', '\nCorrelation Matrix (Close Price Returns):'));

    // Build returns map for pairwise correlation
    const indexReturns = {};

    indices.forEach(idx => {
      const indexData = data.filter(row => row.symbol === idx).sort((a, b) => new Date(a.time) - new Date(b.time));
      const prices = indexData.map(row => parseFloat(row.close)).filter(v => !isNaN(v));
      indexReturns[idx] = calculateReturns(prices);
    });

    // Find minimum length
    const minLen = Math.min(...Object.values(indexReturns).map(r => r.length));

    console.log(`  ${'Index'.padEnd(10)} | ${indices.map(i => i.padEnd(10)).join(' | ')}`);
    console.log(`  ${'-'.repeat(10)}-+-${indices.map(() => '-'.repeat(10)).join('-+-')}`);

    indices.forEach(idx1 => {
      const row = [idx1.padEnd(10)];
      indices.forEach(idx2 => {
        if (idx1 === idx2) {
          row.push('1.00'.padStart(10));
        } else {
          const returns1 = indexReturns[idx1].slice(-minLen);
          const returns2 = indexReturns[idx2].slice(-minLen);

          // Calculate correlation
          const n = returns1.length;
          const mean1 = returns1.reduce((a, b) => a + b, 0) / n;
          const mean2 = returns2.reduce((a, b) => a + b, 0) / n;

          let numerator = 0;
          let denom1 = 0;
          let denom2 = 0;

          for (let i = 0; i < n; i++) {
            numerator += (returns1[i] - mean1) * (returns2[i] - mean2);
            denom1 += Math.pow(returns1[i] - mean1, 2);
            denom2 += Math.pow(returns2[i] - mean2, 2);
          }

          const correlation = numerator / Math.sqrt(denom1 * denom2);
          row.push(correlation.toFixed(2).padStart(10));
        }
      });
      console.log(`  ${row.join(' | ')}`);
    });
  }

  // 8. Key Insights
  printHeader('8. KEY INSIGHTS');

  const insights = [];

  // Insight 1: Data completeness
  const totalMissing = Object.values(missingAnalysis).reduce((sum, v) => sum + v.count, 0);
  if (totalMissing === 0) {
    insights.push('COMPLETE DATA: No missing values found in the dataset');
  } else {
    insights.push(`DATA QUALITY: ${totalMissing.toLocaleString()} missing values detected across columns`);
  }

  // Insight 2: Best performing index
  const performances = [];
  indices.forEach(idx => {
    const indexData = data.filter(row => row.symbol === idx).sort((a, b) => new Date(a.time) - new Date(b.time));
    const prices = indexData.map(row => parseFloat(row.close)).filter(v => !isNaN(v));
    if (prices.length > 1) {
      const totalReturn = (prices[prices.length - 1] - prices[0]) / prices[0];
      performances.push({ index: idx, return: totalReturn });
    }
  });
  performances.sort((a, b) => b.return - a.return);
  if (performances.length > 0) {
    insights.push(`BEST PERFORMER: ${performances[0].index} with total return of ${(performances[0].return * 100).toFixed(2)}%`);
  }

  // Insight 3: Most volatile index
  const volatilities = [];
  indices.forEach(idx => {
    const indexData = data.filter(row => row.symbol === idx).sort((a, b) => new Date(a.time) - new Date(b.time));
    const prices = indexData.map(row => parseFloat(row.close)).filter(v => !isNaN(v));
    const returns = calculateReturns(prices);
    if (returns.length > 0) {
      const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
      const stdReturn = Math.sqrt(returns.reduce((acc, r) => acc + Math.pow(r - meanReturn, 2), 0) / returns.length);
      volatilities.push({ index: idx, volatility: stdReturn });
    }
  });
  volatilities.sort((a, b) => b.volatility - a.volatility);
  if (volatilities.length > 0) {
    insights.push(`HIGHEST VOLATILITY: ${volatilities[0].index} with daily volatility of ${(volatilities[0].volatility * 100).toFixed(2)}%`);
  }

  // Insight 4: Date range coverage
  insights.push(`TEMPORAL COVERAGE: Dataset spans ${daysDiff.toLocaleString()} days from ${dates[0].toISOString().split('T')[0]} to ${dates[dates.length - 1].toISOString().split('T')[0]}`);

  // Insight 5: Data volume
  insights.push(`DATA VOLUME: ${data.length.toLocaleString()} total records across ${indices.length} indices`);

  // Insight 6: Average daily volume
  const totalVolume = data.reduce((sum, row) => sum + (parseFloat(row.volume) || 0), 0);
  const avgDailyVolume = totalVolume / data.length;
  insights.push(`TRADING ACTIVITY: Average daily volume across all indices: ${(avgDailyVolume / 1e6).toFixed(2)}M shares`);

  // Insight 7: Correlation insight
  if (indices.length > 1) {
    insights.push(`INDEX CORRELATION: ${indices.length} indices available for correlation analysis`);
  }

  insights.forEach((insight, i) => {
    console.log(`\n  ${colorize('bright', colorize('blue', `${i + 1}.`))} ${insight}`);
  });

  printHeader('EDA COMPLETE');
}

// Run the analysis
performEDA().catch(console.error);
