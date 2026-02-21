"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  PageTransition,
} from "@/components/ui";
import { Clock, Cpu, FlaskConical, Wrench, Activity, BarChart3, TrendingUp, Info, Zap, Database } from "lucide-react";

export default function MLLabPage() {
  return (
    <PageTransition variant="slideUp">
      <div className="max-w-full space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Quantitative ML Lab</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400">Experimental workspace for training and deploying machine learning models on HOSE data</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-purple-50/50 dark:bg-purple-900/10 border-purple-100 dark:border-purple-900/30 text-purple-600 dark:text-purple-400 font-bold px-3 py-1">
              Status: Sandbox Alpha
            </Badge>
          </div>
        </div>

        {/* Coming Soon Hero */}
        <Card className="rounded-3xl border-2 border-dashed border-gray-200 dark:border-slate-800 bg-gray-50/30 dark:bg-slate-900/30 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8 opacity-10 dark:opacity-20 pointer-events-none">
            <Cpu className="w-64 h-64 text-blue-500" />
          </div>
          <CardContent className="p-12 relative z-10">
            <div className="flex flex-col items-center text-center max-w-2xl mx-auto">
              <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-3xl shadow-xl flex items-center justify-center mb-8 border border-gray-100 dark:border-slate-700 animate-pulse">
                <FlaskConical className="w-10 h-10 text-blue-600" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4 tracking-tight">The Lab is Heating Up</h2>
              <p className="text-sm text-gray-500 dark:text-slate-400 leading-relaxed mb-8">
                We are engineering institutional-grade ML infrastructure to bring predictive analytics to the Vietnamese market. 
                Our pipeline will support training, backtesting, and live-inferencing of advanced architectures.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full mb-10">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Architecture</p>
                  <p className="text-xs font-bold">LSTM & Transformers</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-purple-600 uppercase tracking-widest">Training Data</p>
                  <p className="text-xs font-bold">HOSE 2018 - 2025</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Compute</p>
                  <p className="text-xs font-bold">Distributed GPU</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase bg-white dark:bg-slate-800 px-4 py-2 rounded-full border border-gray-100 dark:border-slate-700">
                  <Clock className="w-3 h-3" />
                  Expected Delivery: Q4 2026
                </div>
                <Badge variant="outline" className="border-blue-200 text-blue-600 bg-blue-50/50">Early Access Soon</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lab Workspace Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Config Sidebar Placeholder */}
          <Card className="opacity-50 dark:opacity-40 grayscale pointer-events-none border-gray-100 dark:border-slate-800 rounded-2xl overflow-hidden">
            <CardHeader className="pb-2 border-b border-gray-100 dark:border-slate-800 mb-4 bg-gray-50/50 dark:bg-slate-900/50">
              <CardTitle className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center">
                <Wrench className="w-3 h-3 mr-2" />
                Hyperparameters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <div className="h-2 w-16 bg-gray-200 dark:bg-slate-800 rounded" />
                <div className="h-9 w-full bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <div className="h-2 w-20 bg-gray-200 dark:bg-slate-800 rounded" />
                <div className="h-9 w-full bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <div className="h-2 w-12 bg-gray-200 dark:bg-slate-800 rounded" />
                <div className="h-9 w-full bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl" />
              </div>
              <div className="pt-4">
                <div className="h-10 w-full bg-blue-600/50 rounded-xl" />
              </div>
            </CardContent>
          </Card>

          {/* Planned Feature Cards */}
          <div className="lg:col-span-2 space-y-6">
            <Tabs defaultValue="models" className="w-full">
              <TabsList className="bg-gray-100 dark:bg-slate-900 rounded-xl p-1 h-10 border border-gray-200 dark:border-slate-800">
                <TabsTrigger value="models" className="rounded-lg px-6 text-xs font-bold">Model Architectures</TabsTrigger>
                <TabsTrigger value="data" className="rounded-lg px-6 text-xs font-bold">Feature Engineering</TabsTrigger>
              </TabsList>

              <TabsContent value="models" className="mt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="rounded-2xl border-gray-100 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="w-4 h-4 text-purple-500" />
                        <CardTitle className="text-sm font-bold">Price Direction Classifiers</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-xs text-gray-500">Predicting binary movements (Bull/Bear) over next T-periods.</p>
                      <div className="space-y-2">
                        {['Random Forest Classifier', 'XGBoost Gradient Boosting', 'LightGBM Optimizations'].map(f => (
                          <div key={f} className="flex items-center gap-2">
                            <div className="w-1 h-1 rounded-full bg-purple-400" />
                            <span className="text-[10px] font-medium text-gray-600 dark:text-slate-400">{f}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-2xl border-gray-100 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2 mb-1">
                        <Activity className="w-4 h-4 text-emerald-500" />
                        <CardTitle className="text-sm font-bold">Volatility Forecasters</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-xs text-gray-500">Estimating risk magnitude and confidence intervals.</p>
                      <div className="space-y-2">
                        {['GARCH(1,1) Dynamics', 'LSTM Sequence Models', 'Probabilistic BNNs'].map(f => (
                          <div key={f} className="flex items-center gap-2">
                            <div className="w-1 h-1 rounded-full bg-emerald-400" />
                            <span className="text-[10px] font-medium text-gray-600 dark:text-slate-400">{f}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="data" className="mt-6">
                <Card className="rounded-2xl border-gray-100 dark:border-slate-800 p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-blue-500" />
                        <span className="text-xs font-bold uppercase tracking-wider">Technical</span>
                      </div>
                      <p className="text-[10px] text-gray-500 leading-relaxed">Auto-computed indicators: RSI, MACD, Ichimoku, and custom oscillators.</p>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-500" />
                        <span className="text-xs font-bold uppercase tracking-wider">Sentiment</span>
                      </div>
                      <p className="text-[10px] text-gray-500 leading-relaxed">NLP-driven market sentiment from financial news and community forums.</p>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Database className="w-4 h-4 text-slate-500" />
                        <span className="text-xs font-bold uppercase tracking-wider">Fundamental</span>
                      </div>
                      <p className="text-[10px] text-gray-500 leading-relaxed">Cross-sectional analysis of P/E, EPS growth, and ROE factors.</p>
                    </div>
                  </div>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Lab Footer Notice */}
        <div className="bg-blue-50/30 dark:bg-slate-900/30 border border-blue-100 dark:border-slate-800 rounded-2xl p-4 flex items-start gap-3">
          <Info className="w-4 h-4 text-blue-500 mt-0.5" />
          <p className="text-[10px] text-gray-500 dark:text-slate-400 leading-relaxed">
            <strong className="text-gray-900 dark:text-slate-200">Experimental Integrity:</strong> All models in the QuantVN Lab will be trained exclusively on verified historical HOSE data (2018-2025). 
            We strictly adhere to zero-mock performance reporting — results will reflect actual out-of-sample testing metrics.
          </p>
        </div>
      </div>
    </PageTransition>
  );
}
