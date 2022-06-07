import { _lt } from "../../translation";
import { CommandResult, SheetId, SpreadsheetChildEnv, Zone } from "../../types";

export const AddMergeInteractiveContent = {
  mergeAcrossFilter: "You can't merge cells that cross the borders of an existing filter.",
  verticalMergeInFilter: "You can't vertically merge cells that intersect an existing filter.",
  mergeIsDestructive:
    "Merging these cells will only preserve the top-leftmost value. Merge anyway?",
};

export function interactiveAddMerge(env: SpreadsheetChildEnv, sheetId: SheetId, target: Zone[]) {
  const result = env.model.dispatch("ADD_MERGE", { sheetId, target });
  if (!result.isSuccessful) {
    if (result.isCancelledBecause(CommandResult.MergeIsDestructive)) {
      env.askConfirmation(_lt(AddMergeInteractiveContent.mergeIsDestructive), () => {
        env.model.dispatch("ADD_MERGE", { sheetId, target, force: true });
      });
    } else if (result.isCancelledBecause(CommandResult.MergeAcrossFilter)) {
      env.notifyUser(_lt(AddMergeInteractiveContent.mergeAcrossFilter));
    } else if (result.isCancelledBecause(CommandResult.VerticalMergeInFilter)) {
      env.notifyUser(_lt(AddMergeInteractiveContent.verticalMergeInFilter));
    }
  }
}
