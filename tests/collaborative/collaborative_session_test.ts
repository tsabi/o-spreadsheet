import * as owl from "@odoo/owl";
import { Session } from "../../src/collaborative/session";
import { DEBOUNCE_TIME } from "../../src/constants";
import { buildRevisionLog } from "../../src/history/factory";
import { Client } from "../../src/types";
import { MockTransportService } from "../__mocks__/transport_service";

describe("Collaborative session", () => {
  let transport: MockTransportService;
  let session: Session;
  let client: Client;

  jest.useFakeTimers();

  jest.spyOn(owl.browser, "setTimeout").mockImplementation(window.setTimeout.bind(window));
  jest.spyOn(owl.browser, "clearTimeout").mockImplementation(window.clearTimeout.bind(window));

  beforeEach(() => {
    transport = new MockTransportService();
    client = {
      id: "alice",
      name: "Alice",
    };
    const revisionLog = buildRevisionLog(
      "START_REVISION",
      () => ({ changes: [], commands: [] }),
      () => ({ status: "SUCCESS" as const })
    );
    session = new Session(revisionLog, transport, client);
    session.join([]);
  });

  test("local client move", () => {
    session.move({ sheetId: "sheetId", col: 0, row: 0 });
    jest.advanceTimersByTime(DEBOUNCE_TIME + 100);
    const spy = jest.spyOn(transport, "sendMessage");

    session.move({ sheetId: "sheetId", col: 1, row: 2 });
    expect(spy).not.toHaveBeenCalled(); // Wait for debounce

    jest.advanceTimersByTime(DEBOUNCE_TIME + 100);
    expect(spy).toHaveBeenCalledWith({
      type: "CLIENT_MOVED",
      client: { ...client, position: { sheetId: "sheetId", col: 1, row: 2 } },
    });

    expect(session.getConnectedClients()).toEqual(
      new Set([{ ...client, position: { sheetId: "sheetId", col: 1, row: 2 } }])
    );
  });

  test("local client leaves", () => {
    const spy = jest.spyOn(transport, "sendMessage");
    session.leave();
    expect(spy).toHaveBeenCalledWith({
      type: "CLIENT_LEFT",
      clientId: client.id,
    });
    expect(session.getConnectedClients()).toEqual(new Set());
  });

  test("remote client move", () => {
    transport.sendMessage({
      type: "CLIENT_MOVED",
      client: { id: "bob", name: "Bob", position: { sheetId: "sheetId", col: 1, row: 2 } },
    });
    expect(session.getConnectedClients()).toEqual(
      new Set([
        client,
        {
          position: { sheetId: "sheetId", col: 1, row: 2 },
          id: "bob",
          name: "Bob",
        },
      ])
    );
    transport.sendMessage({
      type: "CLIENT_LEFT",
      clientId: "bob",
    });
    expect(session.getConnectedClients()).toEqual(new Set([client]));
  });

  test("remote client joins", () => {
    session.move({ sheetId: "sheetId", col: 0, row: 0 });
    jest.advanceTimersByTime(DEBOUNCE_TIME + 100);
    const spy = jest.spyOn(transport, "sendMessage");
    transport.sendMessage({
      type: "CLIENT_JOINED",
      client: { id: "bob", name: "Bob", position: { sheetId: "sheetId", col: 1, row: 2 } },
    });
    expect(spy).toHaveBeenNthCalledWith(2, {
      type: "CLIENT_MOVED",
      client: { ...client, position: { sheetId: "sheetId", col: 0, row: 0 } },
    });
  });

  test("local client joins", () => {
    const spy = jest.spyOn(transport, "sendMessage");
    session.move({ sheetId: "sheetId", col: 1, row: 2 });
    jest.advanceTimersByTime(DEBOUNCE_TIME + 100);
    expect(spy).toHaveBeenCalledWith({
      type: "CLIENT_JOINED",
      client: { ...client, position: { sheetId: "sheetId", col: 1, row: 2 } },
    });
  });

  test("Leave the session do not crash", () => {
    session.move({ sheetId: "sheetId", col: 1, row: 2 });
    session.leave();
    jest.advanceTimersByTime(DEBOUNCE_TIME + 100);
  });

  test("Receiving a bad revision id should trigger", () => {
    const spy = jest.spyOn(session, "trigger");
    // simulate a revision not in sync with the server
    // e.g. the session missed a revision
    session["serverRevisionId"] = "invalid";
    transport.sendMessage({
      type: "REMOTE_REVISION",
      nextRevisionId: "42",
      revision: {
        clientId: "client_42",
        commands: [],
        id: "42",
      },
      serverRevisionId: transport["serverRevisionId"],
    });
    expect(spy).toHaveBeenNthCalledWith(1, "unexpected-revision-id");
  });
});
