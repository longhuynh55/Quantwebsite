export { DataSourceNode } from "./DataSourceNode";
export { IndicatorNode } from "./IndicatorNode";
export { FilterNode } from "./FilterNode";
export { SignalNode } from "./SignalNode";
export { OutputNode } from "./OutputNode";
export { WeightingNode } from "./WeightingNode";
export { ConditionalNode } from "./ConditionalNode";
export { SortNode } from "./SortNode";
export { MathNode } from "./MathNode";
export { MergeNode } from "./MergeNode";
export { RiskNode } from "./RiskNode";
export { BacktestNode } from "./BacktestNode";

import { DataSourceNode } from "./DataSourceNode";
import { IndicatorNode } from "./IndicatorNode";
import { FilterNode } from "./FilterNode";
import { SignalNode } from "./SignalNode";
import { OutputNode } from "./OutputNode";
import { WeightingNode } from "./WeightingNode";
import { ConditionalNode } from "./ConditionalNode";
import { SortNode } from "./SortNode";
import { MathNode } from "./MathNode";
import { MergeNode } from "./MergeNode";
import { RiskNode } from "./RiskNode";
import { BacktestNode } from "./BacktestNode";

// Node type map for React Flow
export const nodeTypes = {
  dataSource: DataSourceNode,
  indicator: IndicatorNode,
  filter: FilterNode,
  signal: SignalNode,
  output: OutputNode,
  weighting: WeightingNode,
  conditional: ConditionalNode,
  sort: SortNode,
  math: MathNode,
  merge: MergeNode,
  risk: RiskNode,
  backtest: BacktestNode,
};

