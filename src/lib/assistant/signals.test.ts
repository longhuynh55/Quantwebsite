import { collectRequiredSignals, getCandidateSymbols } from "@/lib/assistant/signals";

describe("assistant signal routing hardening", () => {
  it("routes noisy fundamentals prompts to fundamentalSnapshot and suppresses marketSnapshot", () => {
    const signals = collectRequiredSignals({
      message: "dm cho toi bctc aaa 2024, uu tien lnst + dong tien hddd, viet ngan gon",
      contextSnapshot: { page: "home" },
      baselineOnlyMode: false,
    });

    expect(signals.some((item) => item.tool === "fundamentalSnapshot")).toBe(true);
    expect(signals.some((item) => item.tool === "marketSnapshot")).toBe(false);
  });

  it("keeps fundamentals signal even when symbol is missing", () => {
    const signals = collectRequiredSignals({
      message: "cho toi bctc nam 2024, doanh thu va lnst",
      contextSnapshot: { page: "home" },
      baselineOnlyMode: false,
    });

    expect(signals.some((item) => item.tool === "fundamentalSnapshot")).toBe(true);
    expect(signals.some((item) => item.tool === "marketSnapshot")).toBe(false);
  });

  it("does not treat LNST shorthand as a symbol candidate", () => {
    const candidates = getCandidateSymbols("AAA nam 2024 cho toi LNST va EPS.", { page: "home" });
    expect(candidates).toContain("AAA");
    expect(candidates).not.toContain("LNST");
  });

  it("extracts lowercase symbol in 'bctc <symbol>' noisy prompts", () => {
    const candidates = getCandidateSymbols("dm cho toi bctc aaa 2024, uu tien lnst", { page: "home" });
    expect(candidates).toContain("AAA");
  });

  it("extracts lowercase banking symbol from 'bank <symbol>' prompts", () => {
    const candidates = getCandidateSymbols("bank acb nam 2024, can bctn + bcdkt", { page: "home" });
    expect(candidates).toContain("ACB");
  });

  it("does not mis-read 'moi nhat' as a symbol in BCTN prompt", () => {
    const candidates = getCandidateSymbols("Cho BCTN moi nhat cua VNM, chi tra doanh thu va loi nhuan sau thue.", {
      page: "home",
    });
    expect(candidates).toContain("VNM");
    expect(candidates).not.toContain("MOI");
  });

  it("routes broad market overview query to marketSnapshot without fundamentals", () => {
    const signals = collectRequiredSignals({
      message: "Cho toi market overview: VNINDEX, top gainer va top loser hien tai.",
      contextSnapshot: { page: "home" },
      baselineOnlyMode: false,
    });

    expect(signals.some((item) => item.tool === "marketSnapshot")).toBe(true);
    expect(signals.some((item) => item.tool === "fundamentalSnapshot")).toBe(false);
  });
});
