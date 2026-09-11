import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { convertMdToPdfTool, convertLatexToPdfTool } from "../../../src/tools/utilities/converterTools.js";
import fs from "node:fs";
import { mdToPdf } from "md-to-pdf";
import latex from "node-latex";

vi.mock("node:fs");
vi.mock("md-to-pdf");
vi.mock("node-latex");

describe("Converter Utilities MCP Tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("convertMdToPdfTool", () => {
    it("should return error if input file is not found", async () => {
      vi.mocked(fs.existsSync).mockReturnValueOnce(false);
      
      const result = await convertMdToPdfTool.execute({
        inputPath: "missing.md",
        outputPath: "output.pdf"
      });

      expect(result.success).toBe(false);
      expect((result as any).error).toBe("FileNotFound");
    });

    it("should successfully convert md to pdf", async () => {
      vi.mocked(fs.existsSync).mockReturnValueOnce(true);
      vi.mocked(mdToPdf).mockResolvedValueOnce({ content: Buffer.from("pdf") } as any);

      const result = await convertMdToPdfTool.execute({
        inputPath: "input.md",
        outputPath: "output.pdf"
      });

      expect(mdToPdf).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  describe("convertLatexToPdfTool", () => {
    it("should return error if input file is not found", async () => {
      vi.mocked(fs.existsSync).mockReturnValueOnce(false);
      
      const result = await convertLatexToPdfTool.execute({
        inputPath: "missing.tex",
        outputPath: "output.pdf"
      });

      expect(result.success).toBe(false);
    });

    // We skip the detailed stream testing for latex since it involves mocking Read/Write streams deeply,
    // but the error checking is validated.
  });
});
