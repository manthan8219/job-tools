import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CompanyRepository } from "../../src/jobs/repositories/companyRepository.js";
import { queryPostgres } from "../../src/db/index.js";

vi.mock("../../src/db/index.js", () => ({
  queryPostgres: vi.fn(),
}));

describe("CompanyRepository", () => {
  let repository: CompanyRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new CompanyRepository();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should initialize the companies table and foreign key", async () => {
    vi.mocked(queryPostgres).mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
      command: "CREATE",
      oid: 0,
      fields: [],
    });

    await repository.init();
    expect(queryPostgres).toHaveBeenCalledTimes(1);
    const sql = vi.mocked(queryPostgres).mock.calls[0][0];
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS companies");
    expect(sql).toContain("ALTER TABLE jobs ADD COLUMN company_id UUID REFERENCES companies(id)");
  });

  it("should seed default companies when table is empty", async () => {
    vi.mocked(queryPostgres)
      .mockResolvedValueOnce({
        rows: [{ count: "0" }],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      })
      .mockResolvedValue({
        rows: [
          {
            id: "uuid-1",
            name: "GitLab",
            slug: "gitlab",
            atsType: "greenhouse",
          },
        ],
        rowCount: 1,
        command: "INSERT",
        oid: 0,
        fields: [],
      });

    await repository.seedDefaultCompanies();
    expect(queryPostgres).toHaveBeenCalled();
    const calls = vi.mocked(queryPostgres).mock.calls;
    expect(calls.length).toBeGreaterThan(5);
  });

  it("should skip seeding when companies already exist", async () => {
    vi.mocked(queryPostgres).mockResolvedValueOnce({
      rows: [{ count: "11" }],
      rowCount: 1,
      command: "SELECT",
      oid: 0,
      fields: [],
    });

    await repository.seedDefaultCompanies();
    expect(queryPostgres).toHaveBeenCalledTimes(1);
  });

  it("should create a company with proper conflict resolution", async () => {
    const mockCompany = {
      id: "comp-uuid",
      name: "Stripe",
      slug: "stripe",
      websiteUrl: "https://stripe.com",
      atsType: "custom",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(queryPostgres).mockResolvedValueOnce({
      rows: [mockCompany],
      rowCount: 1,
      command: "INSERT",
      oid: 0,
      fields: [],
    });

    const result = await repository.createCompany({
      name: "Stripe",
      slug: "stripe",
      websiteUrl: "https://stripe.com",
      atsType: "custom",
    });

    expect(result.name).toBe("Stripe");
    expect(result.slug).toBe("stripe");
    expect(queryPostgres).toHaveBeenCalledTimes(1);
  });

  it("should find an existing company by slug in findOrCreateCompany", async () => {
    const existing = {
      id: "uuid-gitlab",
      name: "GitLab",
      slug: "gitlab",
      atsType: "greenhouse",
    };

    vi.mocked(queryPostgres).mockResolvedValueOnce({
      rows: [existing],
      rowCount: 1,
      command: "SELECT",
      oid: 0,
      fields: [],
    });

    const company = await repository.findOrCreateCompany({
      name: "GitLab",
      slug: "gitlab",
    });

    expect(company.id).toBe("uuid-gitlab");
    expect(queryPostgres).toHaveBeenCalledTimes(1);
  });

  it("should create a new company if not found in findOrCreateCompany", async () => {
    // 1st query: findBySlug -> not found
    vi.mocked(queryPostgres).mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
      command: "SELECT",
      oid: 0,
      fields: [],
    });

    // 2nd query: createCompany -> returns created
    const created = {
      id: "uuid-linear",
      name: "Linear",
      slug: "linear",
      atsType: "ashby",
    };
    vi.mocked(queryPostgres).mockResolvedValueOnce({
      rows: [created],
      rowCount: 1,
      command: "INSERT",
      oid: 0,
      fields: [],
    });

    const company = await repository.findOrCreateCompany({
      name: "Linear",
      atsType: "ashby",
    });

    expect(company.name).toBe("Linear");
    expect(company.slug).toBe("linear");
    expect(queryPostgres).toHaveBeenCalledTimes(2);
  });

  it("should fetch active companies by ATS platform", async () => {
    vi.mocked(queryPostgres).mockResolvedValueOnce({
      rows: [
        { id: "1", name: "GitLab", atsType: "greenhouse", atsBoardToken: "gitlab" },
        { id: "2", name: "Celonis", atsType: "greenhouse", atsBoardToken: "celonis" },
      ],
      rowCount: 2,
      command: "SELECT",
      oid: 0,
      fields: [],
    });

    const companies = await repository.getActiveCompaniesByAts("greenhouse");
    expect(companies).toHaveLength(2);
    expect(companies[0].name).toBe("GitLab");
    expect(queryPostgres).toHaveBeenCalledWith(
      expect.stringContaining("WHERE ats_type = $1 AND is_active = true"),
      ["greenhouse"]
    );
  });

  it("should list companies with filters and active jobs count", async () => {
    // Count query
    vi.mocked(queryPostgres).mockResolvedValueOnce({
      rows: [{ count: "1" }],
      rowCount: 1,
      command: "SELECT",
      oid: 0,
      fields: [],
    });

    // Data query
    vi.mocked(queryPostgres).mockResolvedValueOnce({
      rows: [
        {
          id: "uuid-1",
          name: "GitLab",
          slug: "gitlab",
          industry: "Technology",
          atsType: "greenhouse",
          activeJobsCount: "14",
        },
      ],
      rowCount: 1,
      command: "SELECT",
      oid: 0,
      fields: [],
    });

    const res = await repository.listCompanies({
      query: "git",
      industry: "Technology",
      atsType: "greenhouse",
      limit: 10,
      offset: 0,
    });

    expect(res.totalFound).toBe(1);
    expect(res.companies[0].activeJobsCount).toBe(14);
    expect(res.companies[0].name).toBe("GitLab");
  });
});
