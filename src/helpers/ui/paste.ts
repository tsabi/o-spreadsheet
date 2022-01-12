import { CommandResult, DispatchResult } from "../..";
import { _lt } from "../../translation";
import { ClipboardOptions, SpreadsheetEnv, Zone } from "../../types";

export function handlePasteResult(env: SpreadsheetEnv, result: DispatchResult) {
  if (!result.isSuccessful) {
    if (result.reasons.includes(CommandResult.WrongPasteSelection)) {
      env.notifyUser(_lt("This operation is not allowed with multiple selections."));
    }
    if (result.reasons.includes(CommandResult.WillRemoveExistingMerge)) {
      env.notifyUser(
        _lt(
          "This operation is not possible due to a merge. Please remove the merges first than try again."
        )
      );
    }
  }
}

export function interactivePaste(
  env: SpreadsheetEnv,
  target: Zone[],
  pasteOption?: ClipboardOptions
) {
  const result = env.dispatch("PASTE", { target, pasteOption });
  handlePasteResult(env, result);
}