const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const OUTPUT_FILE = "project-analysis.txt";

// Folders to ignore
const IGNORE = [
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  ".vercel"
];

// File types to include
const VALID_EXT = [".ts", ".tsx", ".js", ".jsx"];

// Store results
let result = {
  pages: [],
  apiRoutes: [],
  components: [],
  functions: []
};

function scanDir(dir) {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const fullPath = path.join(dir, file);

    if (IGNORE.some((ignore) => fullPath.includes(ignore))) return;

    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      scanDir(fullPath);
    } else {
      const ext = path.extname(file);
      if (!VALID_EXT.includes(ext)) return;

      const content = fs.readFileSync(fullPath, "utf-8");

      classifyFile(fullPath, content);
      extractFunctions(fullPath, content);
    }
  });
}

function classifyFile(filePath, content) {
  const relative = filePath.replace(ROOT, "");

  // Next.js App Router pages
  if (relative.includes("/app/") && relative.includes("page.")) {
    result.pages.push(relative);
  }

  // API routes
  if (relative.includes("/api/") || relative.includes("route.")) {
    result.apiRoutes.push(relative);
  }

  // Components
  if (
    relative.includes("/components/") ||
    content.includes("export default function")
  ) {
    result.components.push(relative);
  }
}

function extractFunctions(filePath, content) {
  const lines = content.split("\n");

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (
      trimmed.startsWith("function ") ||
      trimmed.startsWith("export function") ||
      trimmed.startsWith("const ") && trimmed.includes("=>")
    ) {
      result.functions.push(
        `${filePath.replace(ROOT, "")} (line ${index + 1}): ${trimmed}`
      );
    }
  });
}

function writeOutput() {
  let output = "";

  output += "=== PAGES ===\n";
  result.pages.forEach((p) => (output += p + "\n"));

  output += "\n=== API ROUTES ===\n";
  result.apiRoutes.forEach((a) => (output += a + "\n"));

  output += "\n=== COMPONENTS ===\n";
  result.components.forEach((c) => (output += c + "\n"));

  output += "\n=== FUNCTIONS ===\n";
  result.functions.slice(0, 200).forEach((f) => (output += f + "\n"));

  fs.writeFileSync(OUTPUT_FILE, output);
  console.log(`✅ Analysis saved to ${OUTPUT_FILE}`);
}

// Run
scanDir(ROOT);
writeOutput();