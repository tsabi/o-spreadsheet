import { _lt } from "../../translation";
import { CommandResult, SheetId, SpreadsheetChildEnv, Zone } from "../../types";

export const AddFilterInteractiveContent = {
  filterOverlap: "You cannot create overlapping filters.",
  mergeAcrossFilter: "You can't create a filter over a range that cross the border of a merge.",
  verticalMergeInFilter: "You can't create a filter over a range containing vertical merges.",
};

export function interactiveAddFilter(env: SpreadsheetChildEnv, sheetId: SheetId, target: Zone[]) {
  const result = env.model.dispatch("CREATE_FILTER_TABLE", { target, sheetId });
  if (!result.isSuccessful) {
    if (result.isCancelledBecause(CommandResult.FilterOverlap)) {
      env.notifyUser(_lt(AddFilterInteractiveContent.filterOverlap));
    } else if (result.isCancelledBecause(CommandResult.MergeAcrossFilter)) {
      env.notifyUser(_lt(AddFilterInteractiveContent.mergeAcrossFilter));
    } else if (result.isCancelledBecause(CommandResult.VerticalMergeInFilter)) {
      env.notifyUser(_lt(AddFilterInteractiveContent.verticalMergeInFilter));
    }
  }
}
