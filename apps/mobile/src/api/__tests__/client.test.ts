import { apiRequest, ApiError } from "../client";

describe("apiRequest", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
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
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ "x-user-id": expect.any(String) }),
      }),
    );
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
});
