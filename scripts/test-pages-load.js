const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const projectRoot = path.resolve(__dirname, "..");
const publicDir = path.join(projectRoot, "public");
const serverEntry = path.join(projectRoot, "server.js");

function getHtmlFiles(dirPath) {
  return fs
    .readdirSync(dirPath)
    .filter((name) => name.toLowerCase().endsWith(".html"))
    .sort();
}

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Server is not ready yet.
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(`Serveren startede ikke inden for ${timeoutMs} ms`);
}

function startServer(port) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [serverEntry], {
      cwd: projectRoot,
      env: {
        ...process.env,
        PORT: String(port)
      },
      stdio: ["ignore", "pipe", "pipe"]
    });

    let serverOutput = "";

    child.stdout.on("data", (chunk) => {
      const text = String(chunk);
      serverOutput += text;
      process.stdout.write(`[server] ${text}`);
    });

    child.stderr.on("data", (chunk) => {
      const text = String(chunk);
      serverOutput += text;
      process.stderr.write(`[server] ${text}`);
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`Server-processen stoppede med kode ${code}\n${serverOutput}`));
      }
    });

    resolve(child);
  });
}

async function run() {
  const htmlFiles = getHtmlFiles(publicDir);
  if (htmlFiles.length === 0) {
    console.log("Ingen HTML-sider fundet i public/. Test springes over.");
    process.exit(0);
  }

  const baseUrl = process.env.BASE_URL || "http://localhost:3000";
  const parsedBase = new URL(baseUrl);
  const port = Number(parsedBase.port || (parsedBase.protocol === "https:" ? 443 : 80));
  const healthUrl = new URL("/api/health", parsedBase).toString();
  let server = null;

  try {
    await waitForServer(healthUrl, 2000);
    console.log(`Bruger allerede kørende server på ${baseUrl}`);
  } catch {
    server = await startServer(port);
  }

  try {
    await waitForServer(healthUrl);

    const browser = await chromium.launch({ headless: true });
    const errors = [];

    try {
      for (const fileName of htmlFiles) {
        const page = await browser.newPage();
        const pageErrors = new Set();

        page.on("console", (message) => {
          if (message.type() === "error") {
            pageErrors.add(`console.error: ${message.text()}`);
          }
        });

        page.on("pageerror", (error) => {
          pageErrors.add(`pageerror: ${error.message}`);
        });

        page.on("requestfailed", (request) => {
          pageErrors.add(`requestfailed: ${request.method()} ${request.url()} (${request.failure()?.errorText || "unknown"})`);
        });

        page.on("response", (response) => {
          const status = response.status();
          if (status >= 400) {
            pageErrors.add(`http ${status}: ${response.request().method()} ${response.url()}`);
          }
        });

        const url = `${baseUrl}/${fileName}`;
        await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });

        if (pageErrors.size > 0) {
          errors.push({ page: fileName, errors: Array.from(pageErrors) });
        }

        await page.close();
      }
    } finally {
      await browser.close();
    }

    if (errors.length > 0) {
      console.error("\nFejl fundet under side-load test:\n");
      for (const entry of errors) {
        console.error(`- ${entry.page}`);
        for (const message of entry.errors) {
          console.error(`  * ${message}`);
        }
      }
      process.exitCode = 1;
      return;
    }

    console.log(`Alle ${htmlFiles.length} sider blev indlæst uden fejl.`);
  } finally {
    if (server) {
      server.kill("SIGTERM");
    }
  }
}

run().catch((error) => {
  console.error("Testen fejlede:", error.message);
  process.exit(1);
});
