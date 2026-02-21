export { DataSourceNode } from "./DataSourceNode";
export { IndicatorNode } from "./IndicatorNode";
export { FilterNode } from "./FilterNode";
export { SignalNode } from "./SignalNode";
export { OutputNode } from "./OutputNode";

import { DataSourceNode } from "./DataSourceNode";
import { IndicatorNode } from "./IndicatorNode";
import { FilterNode } from "./FilterNode";
import { SignalNode } from "./SignalNode";
import { OutputNode } from "./OutputNode";

// Node type map for React Flow
export const nodeTypes = {
  dataSource: DataSourceNode,
  indicator: IndicatorNode,
  filter: FilterNode,
  signal: SignalNode,
  output: OutputNode,
};
