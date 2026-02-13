import Link from "next/link";
import { Card, CardContent, Badge } from "@/components/ui";
import { BookOpen, GraduationCap, Award, ArrowRight } from "lucide-react";

const TOPICS = {
  beginner: [
    { slug: "what-is-quant", title: "What is Quantitative Finance?", description: "Introduction to quantitative analysis in financial markets.", duration: "10 min" },
    { slug: "reading-ohlcv", title: "Reading OHLCV Data", description: "Understanding Open, High, Low, Close, Volume data.", duration: "15 min" },
    { slug: "basic-statistics", title: "Basic Statistics for Traders", description: "Mean, median, standard deviation, and other concepts.", duration: "20 min" },
    { slug: "market-indices", title: "Understanding Market Indices", description: "What are market indices and how they work.", duration: "10 min" },
  ],
  intermediate: [
    { slug: "technical-indicators", title: "Technical Indicators Deep Dive", description: "RSI, MACD, Bollinger Bands, Moving Averages.", duration: "30 min" },
    { slug: "simple-strategies", title: "Building Simple Trading Strategies", description: "How to create basic trading strategies.", duration: "25 min" },
    { slug: "risk-basics", title: "Risk Management Basics", description: "Position sizing, stop losses, and risk management.", duration: "20 min" },
    { slug: "backtesting-intro", title: "Introduction to Backtesting", description: "How to test strategies on historical data.", duration: "25 min" },
  ],
  advanced: [
    { slug: "factor-models", title: "Factor Models Explained", description: "Momentum, value, size, and other factors.", duration: "35 min" },
    { slug: "portfolio-theory", title: "Modern Portfolio Theory", description: "Markowitz optimization and efficient frontier.", duration: "40 min" },
    { slug: "ml-in-finance", title: "Machine Learning in Finance", description: "Applying ML techniques to financial prediction.", duration: "45 min" },
    { slug: "hose-market", title: "HOSE Market Specifics", description: "Understanding the Vietnamese stock market.", duration: "20 min" },
  ],
};

export default function LearnPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold mb-4">Educational Hub</h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">Learn quantitative finance concepts from beginner to advanced levels, tailored for the Vietnamese stock market.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center"><GraduationCap className="w-6 h-6 text-white" /></div>
              <div><h3 className="font-bold text-lg">Beginner</h3><p className="text-sm text-green-700">4 topics</p></div>
            </div>
            <p className="text-gray-600 mb-4">Start here if you&apos;re new to quantitative finance.</p>
            <Badge variant="success">~55 minutes total</Badge>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center"><BookOpen className="w-6 h-6 text-white" /></div>
              <div><h3 className="font-bold text-lg">Intermediate</h3><p className="text-sm text-blue-700">4 topics</p></div>
            </div>
            <p className="text-gray-600 mb-4">Dive deeper into technical analysis and strategies.</p>
            <Badge variant="default">~100 minutes total</Badge>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center"><Award className="w-6 h-6 text-white" /></div>
              <div><h3 className="font-bold text-lg">Advanced</h3><p className="text-sm text-purple-700">4 topics</p></div>
            </div>
            <p className="text-gray-600 mb-4">Master factor investing and ML applications.</p>
            <Badge variant="secondary">~140 minutes total</Badge>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-8">
        <section>
          <div className="flex items-center gap-2 mb-4"><GraduationCap className="w-6 h-6 text-green-600" /><h2 className="text-2xl font-bold">Beginner Topics</h2></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {TOPICS.beginner.map((topic) => (
              <Link key={topic.slug} href={`/learn/${topic.slug}`}>
                <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer group">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-lg mb-2 group-hover:text-blue-600">{topic.title}</h3>
                        <p className="text-gray-600 text-sm">{topic.description}</p>
                      </div>
                      <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-transform" />
                    </div>
                    <div className="mt-4 flex items-center gap-2"><Badge variant="outline">{topic.duration}</Badge><Badge variant="success">Beginner</Badge></div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-4"><BookOpen className="w-6 h-6 text-blue-600" /><h2 className="text-2xl font-bold">Intermediate Topics</h2></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {TOPICS.intermediate.map((topic) => (
              <Link key={topic.slug} href={`/learn/${topic.slug}`}>
                <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer group">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-lg mb-2 group-hover:text-blue-600">{topic.title}</h3>
                        <p className="text-gray-600 text-sm">{topic.description}</p>
                      </div>
                      <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-transform" />
                    </div>
                    <div className="mt-4 flex items-center gap-2"><Badge variant="outline">{topic.duration}</Badge><Badge variant="default">Intermediate</Badge></div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-4"><Award className="w-6 h-6 text-purple-600" /><h2 className="text-2xl font-bold">Advanced Topics</h2></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {TOPICS.advanced.map((topic) => (
              <Link key={topic.slug} href={`/learn/${topic.slug}`}>
                <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer group">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-lg mb-2 group-hover:text-blue-600">{topic.title}</h3>
                        <p className="text-gray-600 text-sm">{topic.description}</p>
                      </div>
                      <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-transform" />
                    </div>
                    <div className="mt-4 flex items-center gap-2"><Badge variant="outline">{topic.duration}</Badge><Badge variant="secondary">Advanced</Badge></div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

