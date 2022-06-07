import { _lt } from "../../translation";
import { CommandResult, SpreadsheetChildEnv, UID, Zone } from "../../types";

export const AddFilterInteractiveContent = {
  filterOverlap: "You cannot create overlapping filters.",
  nonContinuousTargets: "A filter can only be created on a continuous selection.",
  mergeInFilter: "You can't create a filter over a range that contains a merge.",
};

export function interactiveAddFilter(env: SpreadsheetChildEnv, sheetId: UID, target: Zone[]) {
  const result = env.model.dispatch("CREATE_FILTER_TABLE", { target, sheetId });
  if (!result.isSuccessful) {
    if (result.isCancelledBecause(CommandResult.FilterOverlap)) {
      env.notifyUser(_lt(AddFilterInteractiveContent.filterOverlap));
    } else if (result.isCancelledBecause(CommandResult.MergeInFilter)) {
      env.notifyUser(_lt(AddFilterInteractiveContent.mergeInFilter));
    } else if (result.isCancelledBecause(CommandResult.NonContinuousTargets)) {
      env.notifyUser(_lt(AddFilterInteractiveContent.nonContinuousTargets));
    }
  }
}
