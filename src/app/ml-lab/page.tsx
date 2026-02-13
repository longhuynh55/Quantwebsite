"use client";

import { Card, CardContent, CardHeader, CardTitle, Button, Input, Select, Badge } from "@/components/ui";
import { Brain, Construction, Clock } from "lucide-react";

export default function MLLabPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Machine Learning Lab</h1>
        <p className="text-gray-600 dark:text-gray-400">Experiment with ML models for price direction prediction and volatility forecasting</p>
      </div>

      {/* Coming Soon Banner */}
      <Card className="mb-6 border-2 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
        <CardContent className="p-8">
          <div className="flex flex-col items-center text-center">
            <div className="flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-800 rounded-full mb-4">
              <Construction className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-2xl font-bold text-blue-900 dark:text-blue-100 mb-2">Coming Soon</h2>
            <p className="text-blue-700 dark:text-blue-300 max-w-xl mb-6">
              The Machine Learning Lab is currently under development. We are building real-time ML models
              that will provide actual price direction predictions and volatility forecasts based on
              technical indicators, market sentiment, and historical patterns.
            </p>
            <div className="flex items-center gap-4 text-sm text-blue-600 dark:text-blue-400">
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>Expected: H2 2026</span>
              </div>
              <Badge variant="outline" className="border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300">In Development</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Planned Features */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              Price Direction Prediction
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-gray-600 dark:text-gray-400">
              <li className="flex items-start gap-2">
                <Badge variant="outline" className="mt-0.5 shrink-0">Planned</Badge>
                <span>Random Forest classifier for next-day price movement</span>
              </li>
              <li className="flex items-start gap-2">
                <Badge variant="outline" className="mt-0.5 shrink-0">Planned</Badge>
                <span>LSTM neural network for sequence-based predictions</span>
              </li>
              <li className="flex items-start gap-2">
                <Badge variant="outline" className="mt-0.5 shrink-0">Planned</Badge>
                <span>Feature importance analysis with technical indicators</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              Volatility Forecasting
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-gray-600 dark:text-gray-400">
              <li className="flex items-start gap-2">
                <Badge variant="outline" className="mt-0.5 shrink-0">Planned</Badge>
                <span>GARCH models for volatility prediction</span>
              </li>
              <li className="flex items-start gap-2">
                <Badge variant="outline" className="mt-0.5 shrink-0">Planned</Badge>
                <span>Realized volatility estimation from high-frequency data</span>
              </li>
              <li className="flex items-start gap-2">
                <Badge variant="outline" className="mt-0.5 shrink-0">Planned</Badge>
                <span>Risk-adjusted confidence intervals</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Configuration Preview (Disabled) */}
      <Card className="opacity-60 dark:opacity-70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-gray-400" />
            Model Configuration (Preview)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Symbol</label>
              <Input value="AAA" disabled placeholder="AAA" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Model Type</label>
              <Select
                value="direction"
                disabled
                options={[
                  { value: "direction", label: "Price Direction" },
                  { value: "volatility", label: "Volatility Forecast" },
                ]}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Features</label>
              <Select
                disabled
                options={[
                  { value: "technical", label: "Technical Indicators" },
                  { value: "all", label: "All Features" },
                ]}
              />
            </div>
            <div className="flex items-end">
              <Button disabled className="w-full">
                <Construction className="w-4 h-4 mr-2" />
                Coming Soon
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notice */}
      <div className="mt-6 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          <strong className="text-gray-900 dark:text-white">Note:</strong> All features on this platform use real historical data from the HOSE exchange (2020-2025).
          The ML Lab will maintain this standard by training on actual market data and providing transparent performance metrics.
          No mock or simulated results will be displayed.
        </p>
      </div>
    </div>
  );
}
