import { NextResponse } from "next/server";
import { loadOHLCVForSymbol, loadStockMetadata } from "@/lib/data";
import { toDateKey } from "@/lib/dataPolicy";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const normalizedSymbol = String(symbol ?? "").trim().toUpperCase();

  if (!normalizedSymbol) {
    return NextResponse.json({ error: "Stock symbol is required" }, { status: 400 });
  }

  try {
    const [rows, metadata] = await Promise.all([
      loadOHLCVForSymbol(normalizedSymbol),
      loadStockMetadata(),
    ]);

    if (rows.length === 0) {
      return NextResponse.json({ error: "Stock not found", symbol: normalizedSymbol }, { status: 404 });
    }

    const first = rows[0];
    const latest = rows[rows.length - 1];
    const latestDate = latest.date;

    const oneYearAgo = new Date(latestDate);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const rows1y = rows.filter((row) => row.date >= oneYearAgo);
    const high52w = rows1y.length > 0 ? Math.max(...rows1y.map((row) => row.high)) : latest.high;
    const low52w = rows1y.length > 0 ? Math.min(...rows1y.map((row) => row.low)) : latest.low;

    const meta = metadata.find((item) => item.symbol === normalizedSymbol);

    return NextResponse.json({
      symbol: normalizedSymbol,
      data: rows.map((row) => ({
        date: toDateKey(row.date),
        open: row.open,
        high: row.high,
        low: row.low,
        close: row.close,
        volume: row.volume,
      })),
      count: rows.length,
      stats: {
        latest_price: latest.close,
        latest_date: toDateKey(latest.date),
        latest_volume: latest.volume,
        total_return: first.open !== 0 ? ((latest.close - first.open) / first.open) * 100 : 0,
        high_52w: high52w,
        low_52w: low52w,
        sector: meta?.icbName3,
        industry: meta?.icbName4,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch stock data", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}