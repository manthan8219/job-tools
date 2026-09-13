import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LocationRepository } from "../../src/jobs/repositories/locationRepository.js";
import { queryPostgres } from "../../src/db/index.js";

vi.mock("../../src/db/index.js", () => ({
  queryPostgres: vi.fn(),
}));

describe("LocationRepository", () => {
  let repository: LocationRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new LocationRepository();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should initialize the locations table", async () => {
    vi.mocked(queryPostgres).mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
      command: "CREATE",
      oid: 0,
      fields: [],
    });

    await repository.init();
    expect(queryPostgres).toHaveBeenCalledTimes(1);
    expect(vi.mocked(queryPostgres).mock.calls[0][0]).toContain("CREATE TABLE IF NOT EXISTS locations");
  });

  it("should seed locations when table is empty", async () => {
    vi.mocked(queryPostgres)
      .mockResolvedValueOnce({
        rows: [{ count: "0" }],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      })
      // Multiple insert calls
      .mockResolvedValue({
        rows: [],
        rowCount: 1,
        command: "INSERT",
        oid: 0,
        fields: [],
      });

    await repository.seedLocations();
    expect(queryPostgres).toHaveBeenCalled();
    const calls = vi.mocked(queryPostgres).mock.calls;
    expect(calls.length).toBeGreaterThan(5);
  });

  it("should skip seeding if locations already exist", async () => {
    vi.mocked(queryPostgres).mockResolvedValueOnce({
      rows: [{ count: "25" }],
      rowCount: 1,
      command: "SELECT",
      oid: 0,
      fields: [],
    });

    await repository.seedLocations();
    expect(queryPostgres).toHaveBeenCalledTimes(1);
  });

  it("should find matching location by string", async () => {
    const mockLocations = [
      {
        id: "loc-munich",
        parentId: "loc-bavaria",
        type: "city",
        name: "Munich",
        code: null,
        slug: "munich",
        path: "world.europe.de.bavaria.munich",
        aliases: ["münchen", "muc"],
        createdAt: new Date(),
      },
      {
        id: "loc-de",
        parentId: "loc-europe",
        type: "country",
        name: "Germany",
        code: "DE",
        slug: "germany",
        path: "world.europe.de",
        aliases: ["deutschland"],
        createdAt: new Date(),
      },
      {
        id: "loc-global",
        parentId: "loc-world",
        type: "global",
        name: "Worldwide (Remote)",
        code: "GLOBAL",
        slug: "global",
        path: "world.global",
        aliases: ["worldwide", "anywhere"],
        createdAt: new Date(),
      },
    ];

    vi.mocked(queryPostgres).mockImplementation(async (_sql: string, params?: any[]) => {
      if (params && params[0]) {
        const found = mockLocations.filter(
          (l) => l.slug === params[0] || l.path === params[0] || (l.code && l.code.toUpperCase() === String(params[0]).toUpperCase())
        );
        return {
          rows: found,
          rowCount: found.length,
          command: "SELECT",
          oid: 0,
          fields: [],
        };
      }
      return {
        rows: mockLocations,
        rowCount: mockLocations.length,
        command: "SELECT",
        oid: 0,
        fields: [],
      };
    });

    const matchMunich = await repository.findMatchingLocation("Munich, Germany");
    expect(matchMunich?.slug).toBe("munich");

    const matchGermany = await repository.findMatchingLocation("Remote, Germany");
    expect(matchGermany?.slug).toBe("germany");

    const matchGlobal = await repository.findMatchingLocation("Worldwide (Remote)");
    expect(matchGlobal?.slug).toBe("global");
  });
});
