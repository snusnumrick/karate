import { beforeEach, describe, expect, it, vi } from "vitest";

const createServerClientMock = vi.fn();

vi.mock("@supabase/auth-helpers-remix", () => ({
  createServerClient: (...args: unknown[]) => createServerClientMock(...args),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

function buildClients() {
  const serviceRoleClient = {
    auth: {
      getUser: vi.fn(),
      admin: {
        getUserById: vi.fn(),
      },
    },
    from: vi.fn(),
  };

  const requestClient = {
    auth: {
      getUser: vi.fn(),
      signInWithPassword: vi.fn(),
      admin: {
        getUserById: vi.fn(),
      },
    },
    from: vi.fn(),
  };

  createServerClientMock.mockImplementation((_url: string, key: string) => {
    if (key === process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return serviceRoleClient;
    }

    return requestClient;
  });

  return { serviceRoleClient, requestClient };
}

describe("getSupabaseServerClient", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_ANON_KEY = "anon-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  });

  it("routes legacy supabaseServer auth methods through request-scoped auth", async () => {
    const { serviceRoleClient, requestClient } = buildClients();
    const { getSupabaseServerClient } = await import("../supabase.server");
    const { supabaseServer } = getSupabaseServerClient(new Request("https://example.test/login"));

    await supabaseServer.auth.getUser();

    expect(requestClient.auth.getUser).toHaveBeenCalledTimes(1);
    expect(serviceRoleClient.auth.getUser).not.toHaveBeenCalled();
  });

  it("keeps auth.admin on the service-role client", async () => {
    const { serviceRoleClient, requestClient } = buildClients();
    const { getSupabaseServerClient } = await import("../supabase.server");
    const { supabaseServer } = getSupabaseServerClient(new Request("https://example.test/admin"));

    await supabaseServer.auth.admin.getUserById("user-123");

    expect(serviceRoleClient.auth.admin.getUserById).toHaveBeenCalledWith("user-123");
    expect(requestClient.auth.admin.getUserById).not.toHaveBeenCalled();
  });

  it("preserves service-role access for data queries on supabaseServer", async () => {
    const { serviceRoleClient, requestClient } = buildClients();
    const { getSupabaseServerClient } = await import("../supabase.server");
    const { supabaseServer } = getSupabaseServerClient(new Request("https://example.test/family"));

    supabaseServer.from("profiles");

    expect(serviceRoleClient.from).toHaveBeenCalledWith("profiles");
    expect(requestClient.from).not.toHaveBeenCalled();
  });
});
