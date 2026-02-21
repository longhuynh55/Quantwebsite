import dynamic from "next/dynamic";
import { ChartSkeleton } from "@/components/ui/skeleton";

// Lazy-loaded LineChart with loading skeleton
export const LazyLineChart = dynamic(
  () => import("./LineChart").then((mod) => mod.LineChart),
  {
    loading: () => <ChartSkeleton height={300} />,
    ssr: false, // Charts don't need SSR
  }
);

// Lazy-loaded MultiLineChart with loading skeleton
export const LazyMultiLineChart = dynamic(
  () => import("./LineChart").then((mod) => mod.MultiLineChart),
  {
    loading: () => <ChartSkeleton height={300} />,
    ssr: false,
  }
);

// Lazy-loaded BarChart with loading skeleton
export const LazyBarChart = dynamic(
  () => import("./LineChart").then((mod) => mod.BarChart),
  {
    loading: () => <ChartSkeleton height={300} />,
    ssr: false,
  }
);
