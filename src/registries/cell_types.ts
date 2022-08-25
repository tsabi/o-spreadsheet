import { Registry } from "../registry";
import { EvaluatedCell, Format } from "../types";

//------------------------------------------------------------------------------
// Evaluated Cell Registry
//------------------------------------------------------------------------------

/**
 * Instanciate an evaluated cell object based on the raw string content of a cell.
 */
interface EvaluatedCellBuilder {
  sequence: number;
  /**
   * Check if this factory should be used
   */
  match: (label: string, format?: Format) => boolean;
  createEvaluatedCell: (label: string, format?: string, url?: string) => EvaluatedCell;
}

/**
 * This registry is intended to map a cell content (raw string) to
 * an instance of a cell.
 */
export const evaluatedCellRegistry = new Registry<EvaluatedCellBuilder>();
