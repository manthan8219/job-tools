import { XMLParser } from "fast-xml-parser";

/**
 * Normalizes and decodes common HTML/XML entities that occur in RSS/Atom job feeds
 */
export function sanitizeXmlEntities(rawXml: string): string {
  return rawXml
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&ndash;/g, "-")
    .replace(/&mdash;/g, "-")
    .replace(/&nbsp;/g, " ")
    .replace(/&hellip;/g, "...")
    .replace(/&amp;amp;/g, "&amp;");
}

export interface GenericRssItem {
  title?: string;
  link?: string;
  description?: string;
  pubDate?: string;
  category?: string | string[];
  guid?: string | { "#text"?: string };
  [key: string]: any;
}

/**
 * Parses an RSS or Atom XML string and returns an array of items.
 */
export function parseRssFeed(xmlText: string): GenericRssItem[] {
  const sanitized = sanitizeXmlEntities(xmlText);
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    trimValues: true,
    cdataPropName: "__cdata",
  });

  const parsed = parser.parse(sanitized);

  // RSS 2.0 format: <rss><channel><item>...</item></channel></rss>
  const channelItems = parsed?.rss?.channel?.item;
  if (channelItems) {
    return Array.isArray(channelItems) ? channelItems : [channelItems];
  }

  // Atom format: <feed><entry>...</entry></feed>
  const feedEntries = parsed?.feed?.entry;
  if (feedEntries) {
    const list = Array.isArray(feedEntries) ? feedEntries : [feedEntries];
    return list.map((e: any) => {
      const link = typeof e.link === "string" ? e.link : e.link?.["@_href"] || e.link?.href || "";
      return {
        title: typeof e.title === "string" ? e.title : e.title?.["#text"] || e.title?.__cdata,
        link,
        description: typeof e.summary === "string" ? e.summary : (e.content?.["#text"] || e.content?.__cdata || ""),
        pubDate: e.published || e.updated,
        ...e,
      };
    });
  }

  // Fallback for custom XML structures (e.g., Personio <work-positions><position>...)
  return [];
}
