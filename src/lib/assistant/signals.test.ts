import type { AssistantContextSnapshot } from "@/types/assistant";
import { collectRequiredSignals, getCandidateSymbols } from "@/lib/assistant/signals";

describe("assistant signals symbol extraction", () => {
  const analysisContext: AssistantContextSnapshot = { page: "analysis" };

  it("extracts lowercase symbol in noisy fundamentals query with quarter + ratios", () => {
    const symbols = getCandidateSymbols("acb 2025q2 d/e voi current ratio bn?", analysisContext);
    expect(symbols).toContain("ACB");
  });

  it("extracts lowercase symbol in noisy fundamentals query with multi-metric shorthand", () => {
    const symbols = getCandidateSymbols("fpt 2025q4 ocf fcf eps pbt di", analysisContext);
    expect(symbols).toContain("FPT");
  });

  it("extracts lowercase leading symbol before statement keyword", () => {
    const symbols = getCandidateSymbols("vnm bctn 2024q3 net margin gross margin", analysisContext);
    expect(symbols).toContain("VNM");
  });

  it("does not treat 'ky' period token as a symbol in refinement prompts", () => {
    const symbols = getCandidateSymbols(
      "giu ky 2024Q4, doi bo metric sang OCF va FCF.",
      { page: "analysis", symbol: "ACB" }
    );
    expect(symbols).toContain("ACB");
    expect(symbols).not.toContain("KY");
  });

  it("extracts mixed-case ticker in 'co phieu' phrase with date scope", () => {
    const symbols = getCandidateSymbols("Gia dong cua co phieu VCb ngay 31/12/2025", analysisContext);
    expect(symbols).toContain("VCB");
  });

  it("extracts bare lowercase ticker in price-date query", () => {
    const symbols = getCandidateSymbols("gia dong cua vcb ngay 31/12/2025", analysisContext);
    expect(symbols).toContain("VCB");
  });
});

describe("assistant signals required tools", () => {
  it("does not require fundamentalSnapshot for valuation ranking universe query without symbol", () => {
    const signals = collectRequiredSignals({
      message: "Top 5 co phieu ngan hang tren HOSE ngay 31/12/2025 theo EV/EBITDA cao nhat.",
      contextSnapshot: { page: "home" },
      baselineOnlyMode: false,
    });
    const tools = signals.map((item) => item.tool);
    expect(tools).toContain("valuationRanking");
    expect(tools).not.toContain("fundamentalSnapshot");
  });

  it("routes symbol + date + close query to stockSnapshot", () => {
    const signals = collectRequiredSignals({
      message: "Gia dong cua co phieu VCb ngay 31/12/2025",
      contextSnapshot: { page: "home" },
      baselineOnlyMode: false,
    });
    const tools = signals.map((item) => item.tool);
    expect(tools).toContain("stockSnapshot");
    expect(tools).not.toContain("marketSnapshot");
  });
});

