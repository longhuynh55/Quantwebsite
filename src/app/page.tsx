import { LandingNav, LandingFooter } from "@/components/landing";
import {
  HeroSection,
  ProblemSection,
  SolutionSection,
  FeaturesSection,
  HowItWorksSection,
  ResultsSection,
  DataCoverageSection,
  AIAssistantPreviewSection,
  TestimonialsSection,
  PricingSection,
  FAQSection,
  CTASection,
  SocialProofSection,
  LiveMarketTicker,
  TrustNumbersBar,
  SpeedComparisonSection,
  MiniBacktestSection,
} from "@/components/landing/sections";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-stone-50 dark:bg-neutral-950 font-sans">
      <LandingNav />
      <main id="main-content" tabIndex={-1}>
        <HeroSection />
        <LiveMarketTicker />
        <TrustNumbersBar />
        <ProblemSection />
        <SolutionSection />
        <SpeedComparisonSection />
        <FeaturesSection />
        <HowItWorksSection />
        <MiniBacktestSection />
        <ResultsSection />
        <AIAssistantPreviewSection />
        <DataCoverageSection />
        <TestimonialsSection />
        <PricingSection />
        <FAQSection />
        <SocialProofSection />
        <CTASection />
      </main>
      <LandingFooter />
    </div>
  );
}