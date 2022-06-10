import { _lt } from "../../translation";
import { CommandResult, SheetId, SpreadsheetChildEnv, Zone } from "../../types";

export const AddFilterInteractiveContent = {
  filterOverlap: "You cannot create overlapping filters.",
  mergeInFilter: "You can't create a filter over a range that contains a merge.",
};

export function interactiveAddFilter(env: SpreadsheetChildEnv, sheetId: SheetId, target: Zone[]) {
  const result = env.model.dispatch("CREATE_FILTER_TABLE", { target, sheetId });
  if (!result.isSuccessful) {
    if (result.isCancelledBecause(CommandResult.FilterOverlap)) {
      env.notifyUser(_lt(AddFilterInteractiveContent.filterOverlap));
    } else if (result.isCancelledBecause(CommandResult.MergeInFilter)) {
      env.notifyUser(_lt(AddFilterInteractiveContent.mergeInFilter));
    }
  }
}
