export interface Pivot {
  cache: any; //TODO
  colGroupBys: string[];
  rowGroupBys: string[];
  measures: string[];
  model: string;
  context: any; //TODO
  domain: any[];
  computedDomain?: any[];
  lastUpdate?: any;
  isLoaded: boolean;
}
