import type { AssistantContextSnapshot } from "@/types/assistant";
import { collectRequiredSignals, getCandidateSymbols } from "@/lib/assistant/signals";

describe("assistant signals symbol extraction", () => {
  const analysisContext: AssistantContextSnapshot = { page: "analysis" };
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    jest.resetModules();
  });

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

  it("does not treat English stopwords as tickers in balance-sheet prompts", () => {
    const symbols = getCandidateSymbols("Give me the balance sheet of VCB stock in 2025Q3", analysisContext);
    expect(symbols).toEqual(["VCB"]);
  });

  it("does not treat English verbs near quarters as tickers", () => {
    const symbols = getCandidateSymbols("I want to see 2025Q3 balance sheet of VCB", analysisContext);
    expect(symbols).toEqual(["VCB"]);
  });

  it("extracts lowercase symbol for Vietnamese statement phrases", () => {
    const symbols1 = getCandidateSymbols("Bang can doi ke toan quy 3 2025 cua vcb", analysisContext);
    expect(symbols1).toContain("VCB");

    const symbols2 = getCandidateSymbols("Bao cao tai chinh quy 3 2025 cua vcb", analysisContext);
    expect(symbols2).toContain("VCB");

    const symbols3 = getCandidateSymbols("vcb bang can doi ke toan 2025q3", analysisContext);
    expect(symbols3).toContain("VCB");
  });

  it("filters weak two-letter symbols when stronger symbols exist (configurable)", () => {
    const prompt = "Compare VCB and AB in 2025Q3";

    const symbolsDefault = getCandidateSymbols(prompt, analysisContext);
    expect(symbolsDefault).toEqual(["VCB"]);

    process.env = { ...ORIGINAL_ENV, ASSISTANT_FILTER_WEAK_TWO_LETTER_SYMBOLS: "false" };
    jest.resetModules();
    const { getCandidateSymbols: getCandidateSymbolsNoFilter } =
      require("@/lib/assistant/signals") as typeof import("@/lib/assistant/signals");
    const symbolsNoFilter = getCandidateSymbolsNoFilter(prompt, analysisContext);
    expect(symbolsNoFilter).toEqual(["VCB", "AB"]);
  });

  it("does not infer BAT ticker from 'bat dong san' sector phrase", () => {
    const symbols = getCandidateSymbols(
      "Top 5 co phieu bat dong san tren HOSE ngay 31/12/2025 theo PE cao nhat.",
      { page: "home" }
    );
    expect(symbols).not.toContain("BAT");
  });

  it("prioritizes explicit compare symbols over stale context symbol", () => {
    const symbols = getCandidateSymbols(
      "So sánh VNM và FPT trong giai đoạn 01/01/2024-31/12/2024",
      { page: "analysis", symbol: "VCB" }
    );
    expect(symbols).toEqual(["VNM", "FPT"]);
  });

  it("does not use stale context symbol for universe ranking query", () => {
    const symbols = getCandidateSymbols(
      "Top 10 co phieu HOSE theo PE thap nhat",
      { page: "analysis", symbol: "VCB" }
    );
    expect(symbols).toEqual([]);
  });

  it("only carries history symbol when follow-up cue is explicit", () => {
    const withoutCue = getCandidateSymbols(
      "Cho toi xem lai du lieu",
      { page: "analysis" },
      "Gia dong cua VNM ngay 31/12/2025"
    );
    expect(withoutCue).toEqual([]);

    const withCue = getCandidateSymbols(
      "Tiep tuc ma do va cap nhat them volatility",
      { page: "analysis" },
      "Gia dong cua VNM ngay 31/12/2025"
    );
    expect(withCue).toContain("VNM");
  });

  it("keeps explicit multi-symbol compare list above 3 symbols", () => {
    const symbols = getCandidateSymbols(
      "So sanh VNM, FPT, HPG, MBB va VCB trong 3 nam",
      { page: "analysis" }
    );
    expect(symbols).toEqual(["VNM", "FPT", "HPG", "MBB", "VCB"]);
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

  it("routes recommendation with symbol to stockSnapshot instead of marketSnapshot", () => {
    const signals = collectRequiredSignals({
      message: "Khuyen nghi mua VNM ngan han",
      contextSnapshot: { page: "home" },
      baselineOnlyMode: false,
    });
    const tools = signals.map((item) => item.tool);
    expect(tools).toContain("stockSnapshot");
    expect(tools).not.toContain("marketSnapshot");
  });

  it("keeps broad market overview on marketSnapshot even when history has stale symbol", () => {
    const signals = collectRequiredSignals({
      message: "Cho toi market overview VNINDEX, top gainer va top loser hien tai",
      conversationHistory: "Gia dong cua VNM ngay 31/12/2025",
      contextSnapshot: { page: "home" },
      baselineOnlyMode: false,
    });
    const tools = signals.map((item) => item.tool);
    expect(tools).toContain("marketSnapshot");
    expect(tools).not.toContain("stockSnapshot");
  });

  it("does not force valuationRanking for symbol-scoped valuation with temporal ranking wording", () => {
    const signals = collectRequiredSignals({
      message: "P/E cua VNM cao nhat trong 5 nam qua la bao nhieu?",
      contextSnapshot: { page: "analysis", symbol: "VNM" },
      baselineOnlyMode: false,
    });
    const tools = signals.map((item) => item.tool);
    expect(tools).not.toContain("valuationRanking");
    expect(tools).toContain("peerMultiples");
  });

  it("does not require riskSnapshot when no symbol is provided", () => {
    const signals = collectRequiredSignals({
      message: "Rui ro thi truong hom nay nhu the nao?",
      contextSnapshot: { page: "home" },
      baselineOnlyMode: false,
    });
    const tools = signals.map((item) => item.tool);
    expect(tools).not.toContain("riskSnapshot");
  });

  it("treats HSX alias in exchange filter as HOSE universe scope", () => {
    const signals = collectRequiredSignals({
      message: "Top 5 co phieu theo PE hien tai",
      contextSnapshot: {
        page: "screener",
        filters: {
          exchange: "HSX",
        },
      },
      baselineOnlyMode: false,
    });
    const tools = signals.map((item) => item.tool);
    expect(tools).toContain("valuationRanking");
  });
});

