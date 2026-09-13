import { queryPostgres } from "../../db/index.js";
import { Location, CreateLocationInput } from "../models/location.js";
import { logger } from "../../utils/index.js";
import { randomUUID } from "node:crypto";

export class LocationRepository {
  /**
   * Initializes the hierarchical locations table and indexes
   */
  async init(): Promise<void> {
    try {
      await queryPostgres(`
        CREATE TABLE IF NOT EXISTS locations (
          id UUID PRIMARY KEY,
          parent_id UUID REFERENCES locations(id) ON DELETE CASCADE,
          type VARCHAR(30) NOT NULL,
          name VARCHAR(150) NOT NULL,
          code VARCHAR(10),
          slug VARCHAR(150) NOT NULL,
          path TEXT NOT NULL UNIQUE,
          aliases TEXT[] DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_locations_parent_id ON locations (parent_id);
        CREATE INDEX IF NOT EXISTS idx_locations_type_code ON locations (type, code);
        CREATE INDEX IF NOT EXISTS idx_locations_path_prefix ON locations (path);
      `);
      logger.info("[LocationRepository] Initialized locations table in PostgreSQL");
    } catch (error) {
      logger.error("[LocationRepository] Failed to initialize locations table", error);
      throw error;
    }
  }

  /**
   * Populates the canonical location tree if table is empty
   */
  async seedLocations(): Promise<void> {
    try {
      const existing = await queryPostgres("SELECT COUNT(*) AS count FROM locations");
      if (parseInt(existing.rows[0].count, 10) > 0) {
        return;
      }

      logger.info("[LocationRepository] Seeding canonical location hierarchy tree...");

      // 1. Root
      const worldId = randomUUID();
      await this.insertRow({
        id: worldId,
        parentId: null,
        type: "global",
        name: "World",
        code: "WORLD",
        slug: "world",
        path: "world",
        aliases: ["worldwide", "anywhere", "global", "remote"],
      });

      // 2. Macro Regions
      const europeId = randomUUID();
      await this.insertRow({
        id: europeId,
        parentId: worldId,
        type: "macro_region",
        name: "Europe",
        code: "EU",
        slug: "europe",
        path: "world.europe",
        aliases: ["emea", "eu", "european union"],
      });

      const northAmericaId = randomUUID();
      await this.insertRow({
        id: northAmericaId,
        parentId: worldId,
        type: "macro_region",
        name: "North America",
        code: "NA",
        slug: "north-america",
        path: "world.north-america",
        aliases: ["americas"],
      });

      const asiaId = randomUUID();
      await this.insertRow({
        id: asiaId,
        parentId: worldId,
        type: "macro_region",
        name: "Asia",
        code: "AS",
        slug: "asia",
        path: "world.asia",
        aliases: ["apac"],
      });

      // Global Remote Node
      const globalRemoteId = randomUUID();
      await this.insertRow({
        id: globalRemoteId,
        parentId: worldId,
        type: "global",
        name: "Worldwide (Remote)",
        code: "GLOBAL",
        slug: "global",
        path: "world.global",
        aliases: ["worldwide", "anywhere", "remote", "global", "everywhere"],
      });

      // 3. Countries & Major Cities
      // Germany
      const deId = randomUUID();
      await this.insertRow({
        id: deId,
        parentId: europeId,
        type: "country",
        name: "Germany",
        code: "DE",
        slug: "germany",
        path: "world.europe.de",
        aliases: ["de", "deutschland", "germany"],
      });

      await this.insertRow({
        id: randomUUID(),
        parentId: deId,
        type: "city",
        name: "Berlin",
        code: null,
        slug: "berlin",
        path: "world.europe.de.berlin",
        aliases: ["berlin, germany", "berlin, de"],
      });

      const bavariaId = randomUUID();
      await this.insertRow({
        id: bavariaId,
        parentId: deId,
        type: "state",
        name: "Bavaria",
        code: "BY",
        slug: "bavaria",
        path: "world.europe.de.bavaria",
        aliases: ["bayern"],
      });

      await this.insertRow({
        id: randomUUID(),
        parentId: bavariaId,
        type: "city",
        name: "Munich",
        code: null,
        slug: "munich",
        path: "world.europe.de.bavaria.munich",
        aliases: ["münchen", "munich, germany", "muc"],
      });

      await this.insertRow({
        id: randomUUID(),
        parentId: deId,
        type: "city",
        name: "Frankfurt",
        code: null,
        slug: "frankfurt",
        path: "world.europe.de.frankfurt",
        aliases: ["frankfurt am main", "fra"],
      });

      // Canada
      const caId = randomUUID();
      await this.insertRow({
        id: caId,
        parentId: northAmericaId,
        type: "country",
        name: "Canada",
        code: "CA",
        slug: "canada",
        path: "world.north-america.ca",
        aliases: ["ca", "canada"],
      });

      const ontarioId = randomUUID();
      await this.insertRow({
        id: ontarioId,
        parentId: caId,
        type: "state",
        name: "Ontario",
        code: "ON",
        slug: "ontario",
        path: "world.north-america.ca.ontario",
        aliases: ["on, canada", "ontario, canada"],
      });

      await this.insertRow({
        id: randomUUID(),
        parentId: ontarioId,
        type: "city",
        name: "Toronto",
        code: null,
        slug: "toronto",
        path: "world.north-america.ca.ontario.toronto",
        aliases: ["toronto, on", "toronto, canada", "yyz"],
      });

      await this.insertRow({
        id: randomUUID(),
        parentId: ontarioId,
        type: "city",
        name: "Ottawa",
        code: null,
        slug: "ottawa",
        path: "world.north-america.ca.ontario.ottawa",
        aliases: ["ottawa, on"],
      });

      const bcId = randomUUID();
      await this.insertRow({
        id: bcId,
        parentId: caId,
        type: "state",
        name: "British Columbia",
        code: "BC",
        slug: "british-columbia",
        path: "world.north-america.ca.british-columbia",
        aliases: ["bc, canada", "b.c."],
      });

      await this.insertRow({
        id: randomUUID(),
        parentId: bcId,
        type: "city",
        name: "Vancouver",
        code: null,
        slug: "vancouver",
        path: "world.north-america.ca.british-columbia.vancouver",
        aliases: ["vancouver, bc", "yvr"],
      });

      // United States
      const usId = randomUUID();
      await this.insertRow({
        id: usId,
        parentId: northAmericaId,
        type: "country",
        name: "United States",
        code: "US",
        slug: "united-states",
        path: "world.north-america.us",
        aliases: ["usa", "us", "united states", "america"],
      });

      const caliId = randomUUID();
      await this.insertRow({
        id: caliId,
        parentId: usId,
        type: "state",
        name: "California",
        code: "CA",
        slug: "california",
        path: "world.north-america.us.california",
        aliases: ["ca, usa", "california, us"],
      });

      await this.insertRow({
        id: randomUUID(),
        parentId: caliId,
        type: "city",
        name: "San Francisco",
        code: null,
        slug: "san-francisco",
        path: "world.north-america.us.california.san-francisco",
        aliases: ["sf", "san francisco, ca", "bay area", "silicon valley"],
      });

      await this.insertRow({
        id: randomUUID(),
        parentId: caliId,
        type: "city",
        name: "Los Angeles",
        code: null,
        slug: "los-angeles",
        path: "world.north-america.us.california.los-angeles",
        aliases: ["la", "los angeles, ca"],
      });

      const nyId = randomUUID();
      await this.insertRow({
        id: nyId,
        parentId: usId,
        type: "state",
        name: "New York",
        code: "NY",
        slug: "new-york",
        path: "world.north-america.us.new-york",
        aliases: ["ny, usa"],
      });

      await this.insertRow({
        id: randomUUID(),
        parentId: nyId,
        type: "city",
        name: "New York City",
        code: null,
        slug: "new-york-city",
        path: "world.north-america.us.new-york.nyc",
        aliases: ["nyc", "new york, ny", "manhattan", "brooklyn"],
      });

      // United Kingdom
      const gbId = randomUUID();
      await this.insertRow({
        id: gbId,
        parentId: europeId,
        type: "country",
        name: "United Kingdom",
        code: "GB",
        slug: "united-kingdom",
        path: "world.europe.gb",
        aliases: ["uk", "gb", "great britain", "england"],
      });

      await this.insertRow({
        id: randomUUID(),
        parentId: gbId,
        type: "city",
        name: "London",
        code: null,
        slug: "london",
        path: "world.europe.gb.london",
        aliases: ["london, uk", "greater london"],
      });

      // India
      const inId = randomUUID();
      await this.insertRow({
        id: inId,
        parentId: asiaId,
        type: "country",
        name: "India",
        code: "IN",
        slug: "india",
        path: "world.asia.in",
        aliases: ["in", "india", "bharat"],
      });

      await this.insertRow({
        id: randomUUID(),
        parentId: inId,
        type: "city",
        name: "Bengaluru",
        code: null,
        slug: "bengaluru",
        path: "world.asia.in.bengaluru",
        aliases: ["bangalore", "bengaluru, india", "bangalore, in"],
      });

      await this.insertRow({
        id: randomUUID(),
        parentId: inId,
        type: "city",
        name: "Hyderabad",
        code: null,
        slug: "hyderabad",
        path: "world.asia.in.hyderabad",
        aliases: ["hyderabad, india", "cyberabad"],
      });

      logger.info("[LocationRepository] Finished seeding canonical location tree.");
    } catch (error) {
      logger.error("[LocationRepository] Error during location tree seeding", error);
      throw error;
    }
  }

  private async insertRow(row: {
    id: string;
    parentId: string | null;
    type: string;
    name: string;
    code: string | null;
    slug: string;
    path: string;
    aliases: string[];
  }): Promise<void> {
    await queryPostgres(
      `INSERT INTO locations (id, parent_id, type, name, code, slug, path, aliases)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (path) DO NOTHING`,
      [row.id, row.parentId, row.type, row.name, row.code, row.slug, row.path, row.aliases]
    );
  }

  /**
   * Resolves a raw location string (e.g. "Munich, Germany", "Remote - US", "Toronto, ON") to the most specific location node
   */
  async findMatchingLocation(locationStr?: string): Promise<Location | null> {
    if (!locationStr) return null;

    const locLower = locationStr.toLowerCase().trim();

    // Check for worldwide / remote global
    if (
      locLower === "worldwide" ||
      locLower === "anywhere" ||
      locLower === "global" ||
      locLower === "remote" ||
      locLower.includes("worldwide (remote)")
    ) {
      return await this.findBySlug("global");
    }

    const allLocations = await this.listAllLocations();

    // 1. First priority: Match city (most specific leaf node)
    const cities = allLocations.filter((l) => l.type === "city");
    for (const city of cities) {
      if (
        locLower.includes(city.name.toLowerCase()) ||
        city.aliases.some((alias) => locLower.includes(alias.toLowerCase()))
      ) {
        return city;
      }
    }

    // 2. Second priority: Match state / province
    const states = allLocations.filter((l) => l.type === "state");
    for (const state of states) {
      if (
        locLower.includes(state.name.toLowerCase()) ||
        state.aliases.some((alias) => locLower.includes(alias.toLowerCase()))
      ) {
        return state;
      }
    }

    // 3. Third priority: Match country
    const countries = allLocations.filter((l) => l.type === "country");
    for (const country of countries) {
      if (
        locLower.includes(country.name.toLowerCase()) ||
        (country.code && locLower.includes(country.code.toLowerCase())) ||
        country.aliases.some((alias) => locLower.includes(alias.toLowerCase()))
      ) {
        return country;
      }
    }

    // 4. Fourth priority: Macro regions
    const regions = allLocations.filter((l) => l.type === "macro_region");
    for (const region of regions) {
      if (
        locLower.includes(region.name.toLowerCase()) ||
        region.aliases.some((alias) => locLower.includes(alias.toLowerCase()))
      ) {
        return region;
      }
    }

    return null;
  }

  async findByPath(path: string): Promise<Location | null> {
    const res = await queryPostgres(
      `SELECT id, parent_id AS "parentId", type, name, code, slug, path, aliases, created_at AS "createdAt"
       FROM locations WHERE path = $1`,
      [path]
    );
    return res.rows[0] || null;
  }

  async findByCode(code: string): Promise<Location | null> {
    const res = await queryPostgres(
      `SELECT id, parent_id AS "parentId", type, name, code, slug, path, aliases, created_at AS "createdAt"
       FROM locations WHERE UPPER(code) = UPPER($1) LIMIT 1`,
      [code]
    );
    return res.rows[0] || null;
  }

  async findBySlug(slug: string): Promise<Location | null> {
    const res = await queryPostgres(
      `SELECT id, parent_id AS "parentId", type, name, code, slug, path, aliases, created_at AS "createdAt"
       FROM locations WHERE slug = $1 LIMIT 1`,
      [slug]
    );
    return res.rows[0] || null;
  }

  async listAllLocations(): Promise<Location[]> {
    const res = await queryPostgres(
      `SELECT id, parent_id AS "parentId", type, name, code, slug, path, aliases, created_at AS "createdAt"
       FROM locations ORDER BY type ASC, name ASC`
    );
    return res.rows;
  }

  async listCountries(): Promise<Location[]> {
    const res = await queryPostgres(
      `SELECT id, parent_id AS "parentId", type, name, code, slug, path, aliases, created_at AS "createdAt"
       FROM locations WHERE type = 'country' ORDER BY name ASC`
    );
    return res.rows;
  }
}
