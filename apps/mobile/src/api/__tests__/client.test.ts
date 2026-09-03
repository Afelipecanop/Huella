jest.mock("../../auth/session", () => ({
  getAccessToken: jest.fn(() => null),
  getRefreshToken: jest.fn(() => null),
  getSession: jest.fn(() => null),
  saveSession: jest.fn(),
  clearSession: jest.fn(),
}));

import { apiRequest, ApiError } from "../client";
import * as session from "../../auth/session";

const mockedSession = session as jest.Mocked<typeof session>;

describe("apiRequest", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    mockedSession.getAccessToken.mockReturnValue(null);
    mockedSession.getRefreshToken.mockReturnValue(null);
    mockedSession.getSession.mockReturnValue(null);
  });

  test("GET returns parsed JSON on success", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "abc" }),
    });

    const result = await apiRequest<{ id: string }>("/accounts");

    expect(result).toEqual({ id: "abc" });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/accounts"),
      expect.objectContaining({ method: "GET" }),
    );
  });

  test("attaches Authorization: Bearer when there is an access token", async () => {
    mockedSession.getAccessToken.mockReturnValue("token-123");
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });

    await apiRequest("/accounts");

    const [, requestInit] = (global.fetch as jest.Mock).mock.calls[0];
    expect(requestInit.headers.authorization).toBe("Bearer token-123");
  });

  test("204 responses resolve to undefined", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 204, json: async () => ({}) });

    const result = await apiRequest<void>("/accounts/1", { method: "DELETE" });

    expect(result).toBeUndefined();
  });

  test("DELETE with no body does not send a content-type header", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 204, json: async () => ({}) });

    await apiRequest("/accounts/1", { method: "DELETE" });

    const [, requestInit] = (global.fetch as jest.Mock).mock.calls[0];
    expect(requestInit.headers["content-type"]).toBeUndefined();
  });

  test("non-2xx throws ApiError with the backend's error message and issues", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "Datos inválidos", issues: [{ path: ["amount"] }] }),
    });

    await expect(apiRequest("/transactions", { method: "POST", body: {} })).rejects.toMatchObject({
      status: 400,
      message: "Datos inválidos",
      issues: [{ path: ["amount"] }],
    });
    await expect(apiRequest("/transactions", { method: "POST", body: {} })).rejects.toBeInstanceOf(ApiError);
  });

  test("on 401 with an active session, refreshes and retries once", async () => {
    mockedSession.getAccessToken.mockReturnValue("expired-token");
    mockedSession.getRefreshToken.mockReturnValue("refresh-abc");
    mockedSession.getSession.mockReturnValue({
      accessToken: "expired-token",
      refreshToken: "refresh-abc",
      user: { id: "u1" } as never,
    });

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ error: "expired" }) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: "new-token",
          refresh_token: "new-refresh",
          user: { id: "u1" },
        }),
      })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: "abc" }) });

    const result = await apiRequest<{ id: string }>("/accounts");

    expect(result).toEqual({ id: "abc" });
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(mockedSession.saveSession).toHaveBeenCalledWith({
      accessToken: "new-token",
      refreshToken: "new-refresh",
      user: { id: "u1" },
    });
  });

  test("clears the session when refresh also fails after a 401", async () => {
    mockedSession.getAccessToken.mockReturnValue("expired-token");
    mockedSession.getRefreshToken.mockReturnValue("refresh-abc");
    mockedSession.getSession.mockReturnValue({
      accessToken: "expired-token",
      refreshToken: "refresh-abc",
      user: { id: "u1" } as never,
    });

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ error: "expired" }) })
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ error: "invalid refresh" }) });

    await expect(apiRequest("/accounts")).rejects.toBeInstanceOf(ApiError);
    expect(mockedSession.clearSession).toHaveBeenCalled();
  });
});
