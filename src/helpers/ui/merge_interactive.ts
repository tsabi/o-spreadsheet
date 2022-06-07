import { _lt } from "../../translation";
import { CommandResult, SpreadsheetChildEnv, UID, Zone } from "../../types";

export const AddMergeInteractiveContent = {
  mergeInFilter: "You can't merge cells inside of an existing filter.",
  mergeIsDestructive:
    "Merging these cells will only preserve the top-leftmost value. Merge anyway?",
};

export function interactiveAddMerge(env: SpreadsheetChildEnv, sheetId: UID, target: Zone[]) {
  const result = env.model.dispatch("ADD_MERGE", { sheetId, target });
  if (!result.isSuccessful) {
    if (result.isCancelledBecause(CommandResult.MergeIsDestructive)) {
      env.askConfirmation(_lt(AddMergeInteractiveContent.mergeIsDestructive), () => {
        env.model.dispatch("ADD_MERGE", { sheetId, target, force: true });
      });
    } else if (result.isCancelledBecause(CommandResult.MergeInFilter)) {
      env.notifyUser(_lt(AddMergeInteractiveContent.mergeInFilter));
    }
  }
}
