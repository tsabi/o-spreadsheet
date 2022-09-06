import {
  AddFilterInteractiveContent,
  interactiveAddFilter,
} from "../../src/helpers/ui/filter_interactive";
import {
  AddMergeInteractiveContent,
  interactiveAddMerge,
} from "../../src/helpers/ui/merge_interactive";
import { interactiveRenameSheet } from "../../src/helpers/ui/sheet";
import { Model } from "../../src/model";
import { EditTextOptions, SpreadsheetChildEnv, UID } from "../../src/types";
import {
  createFilter,
  createSheetWithName,
  merge,
  setCellContent,
} from "../test_helpers/commands_helpers";
import { makeInteractiveTestEnv, target } from "../test_helpers/helpers";

describe("UI Helpers", () => {
  test.each([
    ["", "The sheet name cannot be empty."],
    [
      "hééélo///",
      "Some used characters are not allowed in a sheet name (Forbidden characters are ' * ? / \\ [ ]).",
    ],
  ])(
    "Rename a sheet with interaction with wrong name %s",
    async (sheetName, expectedErrorMessage) => {
      const nameCallback = jest.fn().mockReturnValueOnce(sheetName).mockReturnValueOnce("new name");
      const titleTextSpy = jest.fn();
      const errorTextSpy = jest.fn();
      const editText = (
        title: string,
        callback: (text: string | null) => any,
        options: EditTextOptions
      ) => {
        titleTextSpy(title.toString());
        errorTextSpy(options?.error?.toString());
        callback(nameCallback());
      };
      const model = new Model({});
      const env = makeInteractiveTestEnv(model, { editText });
      interactiveRenameSheet(env, model.getters.getActiveSheetId());
      expect(titleTextSpy).toHaveBeenCalledTimes(2);
      expect(titleTextSpy).toHaveBeenNthCalledWith(1, "Rename Sheet");
      expect(titleTextSpy).toHaveBeenNthCalledWith(2, "Rename Sheet");
      expect(errorTextSpy).toHaveBeenCalledTimes(2);
      expect(errorTextSpy).toHaveBeenNthCalledWith(1, undefined);
      expect(errorTextSpy).toHaveBeenNthCalledWith(2, expectedErrorMessage);
    }
  );

  test("Rename a sheet with interaction with same name as other sheet", async () => {
    const sheetName = "existing sheet";
    const nameCallback = jest.fn().mockReturnValueOnce(sheetName).mockReturnValueOnce("new name");
    const titleTextSpy = jest.fn();
    const errorTextSpy = jest.fn();
    const editText = (
      title: string,
      callback: (text: string | null) => any,
      options: EditTextOptions
    ) => {
      titleTextSpy(title.toString());
      errorTextSpy(options?.error?.toString());
      callback(nameCallback());
    };
    const model = new Model({});
    const env = makeInteractiveTestEnv(model, { editText });
    createSheetWithName(model, { sheetId: "42", activate: false }, sheetName);
    interactiveRenameSheet(env, model.getters.getActiveSheetId());
    expect(titleTextSpy).toHaveBeenCalledTimes(2);
    expect(titleTextSpy).toHaveBeenCalledWith("Rename Sheet");
    expect(errorTextSpy).toHaveBeenCalledTimes(2);
    expect(errorTextSpy).toHaveBeenNthCalledWith(1, undefined);
    expect(errorTextSpy).toHaveBeenNthCalledWith(
      2,
      `A sheet with the name ${sheetName} already exists. Please select another name.`
    );
  });

  describe("Interactive Create Filter", () => {
    let model: Model;
    let sheetId: UID;
    let contentTextSpy: jest.Mock<any, any>;
    let env: SpreadsheetChildEnv;

    beforeEach(() => {
      model = new Model();
      sheetId = model.getters.getActiveSheetId();
      contentTextSpy = jest.fn();
      const notifyUser = (content: string) => {
        contentTextSpy(content.toString());
      };
      env = makeInteractiveTestEnv(model, { notifyUser });
    });

    test("Successfully create a filter", () => {
      interactiveAddFilter(env, sheetId, target("A1:B5"));
      expect(contentTextSpy).toHaveBeenCalledTimes(0);
    });

    test("Create a filter across a merge", () => {
      merge(model, "A1:A2");
      interactiveAddFilter(env, sheetId, target("A1:B1"));
      expect(contentTextSpy).toHaveBeenCalledWith(
        AddFilterInteractiveContent.mergeInFilter.toString()
      );
    });

    test("Create a filter across another filter", () => {
      createFilter(model, "A1:A2");
      interactiveAddFilter(env, sheetId, target("A1:B5"));
      expect(contentTextSpy).toHaveBeenCalledWith(
        AddFilterInteractiveContent.filterOverlap.toString()
      );
    });

    test("Create filters with non-continuous zones", () => {
      interactiveAddFilter(env, sheetId, target("A1:A2,C3"));
      expect(contentTextSpy).toHaveBeenCalledWith(
        AddFilterInteractiveContent.nonContinuousTargets.toString()
      );
    });
  });

  describe("Interactive Add Merge", () => {
    let model: Model;
    let sheetId: UID;
    let notifyUserTextSpy: jest.Mock<any, any>;
    let askConfirmationTextSpy: jest.Mock<any, any>;
    let env: SpreadsheetChildEnv;

    beforeEach(() => {
      model = new Model();
      sheetId = model.getters.getActiveSheetId();
      notifyUserTextSpy = jest.fn();
      askConfirmationTextSpy = jest.fn();
      const notifyUser = (content: string) => {
        notifyUserTextSpy(content.toString());
      };
      const askConfirmation = (content: string, confirm: () => any, cancel?: () => any) => {
        askConfirmationTextSpy(content.toString());
      };
      env = makeInteractiveTestEnv(model, { notifyUser, askConfirmation });
    });

    test("Successfully Create a merge", () => {
      interactiveAddMerge(env, sheetId, target("A1:B5"));
      expect(askConfirmationTextSpy).toHaveBeenCalledTimes(0);
      expect(notifyUserTextSpy).toHaveBeenCalledTimes(0);
    });

    test("Destructive merge", () => {
      setCellContent(model, "A2", ":)");
      interactiveAddMerge(env, sheetId, target("A1:B5"));
      expect(askConfirmationTextSpy).toHaveBeenCalledWith(
        AddMergeInteractiveContent.mergeIsDestructive
      );
    });

    test("Create a merge inside a filter", () => {
      createFilter(model, "A1:A2");
      interactiveAddMerge(env, sheetId, target("A1:B5"));
      expect(notifyUserTextSpy).toHaveBeenCalledWith(AddMergeInteractiveContent.mergeInFilter);
    });
  });
});
