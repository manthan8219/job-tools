import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { mdToPdf } from "md-to-pdf";
import { createRequire } from "node:module";
import { logger } from "../../utils/index.js";

const require = createRequire(import.meta.url);
const latex = require("node-latex");

const ConvertFileInput = z.object({
  inputPath: z.string().describe("The absolute or relative path to the input file (.md or .tex)"),
  outputPath: z.string().describe("The absolute or relative path where the .pdf should be saved"),
});

export const convertMdToPdfTool = createTool({
  id: "convert-md-to-pdf",
  description:
    "Converts a Markdown (.md) resume file to a beautifully formatted PDF using Puppeteer. Once generated, pass the outputPath to the 'uploadResumeFile' tool to store the PDF in cloud or local storage and link it to the user's profile.",
  inputSchema: ConvertFileInput,
  execute: async ({ inputPath, outputPath }) => {
    try {
      const resolvedInput = path.resolve(inputPath);
      const resolvedOutput = path.resolve(outputPath);

      if (!fs.existsSync(resolvedInput)) {
        return { success: false, error: "FileNotFound", message: `Input file not found at ${resolvedInput}` };
      }

      logger.info(`Starting Markdown to PDF conversion: ${resolvedInput} -> ${resolvedOutput}`);
      
      const pdf = await mdToPdf({ path: resolvedInput }, { dest: resolvedOutput });
      
      if (pdf) {
        logger.info(`Successfully converted Markdown to PDF: ${resolvedOutput}`);
        return { success: true, message: `Successfully created PDF at ${resolvedOutput}` };
      } else {
        return { success: false, error: "ConversionError", message: "md-to-pdf returned an empty result without throwing." };
      }
    } catch (error: any) {
      logger.error("Markdown to PDF conversion failed", error);
      return { success: false, error: error.name || "Error", message: error.message };
    }
  },
});

export const convertLatexToPdfTool = createTool({
  id: "convert-latex-to-pdf",
  description:
    "Converts a LaTeX (.tex) resume file to a PDF using pdflatex. Once generated, pass the outputPath to the 'uploadResumeFile' tool to persist the PDF in cloud or local storage.",
  inputSchema: ConvertFileInput,
  execute: async ({ inputPath, outputPath }) => {
    return new Promise<any>((resolve) => {
      try {
        const resolvedInput = path.resolve(inputPath);
        const resolvedOutput = path.resolve(outputPath);

        if (!fs.existsSync(resolvedInput)) {
          resolve({ success: false, error: "FileNotFound", message: `Input file not found at ${resolvedInput}` });
          return;
        }

        logger.info(`Starting LaTeX to PDF conversion: ${resolvedInput} -> ${resolvedOutput}`);

        const input = fs.createReadStream(resolvedInput);
        const output = fs.createWriteStream(resolvedOutput);

        // Uses pdflatex from the system
        const pdf = latex(input, { errorLogs: true });

        pdf.pipe(output);

        let errorOccurred = false;

        pdf.on("error", (err: any) => {
          errorOccurred = true;
          logger.error("LaTeX to PDF compilation failed. Ensure pdflatex is installed on the host system.", err);
          
          // Clean up the potentially empty/corrupt output file
          fs.unlink(resolvedOutput, () => {});
          
          resolve({
            success: false,
            error: "LatexCompilationError",
            message: `Compilation failed. Please ensure 'pdflatex' is installed and in your PATH. Details: ${err.message}`,
          });
        });

        pdf.on("finish", () => {
          if (!errorOccurred) {
            logger.info(`Successfully converted LaTeX to PDF: ${resolvedOutput}`);
            resolve({ success: true, message: `Successfully created PDF at ${resolvedOutput}` });
          }
        });
      } catch (error: any) {
        logger.error("LaTeX to PDF execution failed", error);
        resolve({ success: false, error: error.name || "Error", message: error.message });
      }
    });
  },
});
