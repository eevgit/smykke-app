const { spawn } = require("child_process");
const path = require("path");
const { chromium } = require("playwright");

const projectRoot = path.resolve(__dirname, "..");
const serverEntry = path.join(projectRoot, "server.js");

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
      env: { ...process.env, PORT: String(port) },
      stdio: ["ignore", "pipe", "pipe"]
    });

    let serverOutput = "";
    child.stdout.on("data", (chunk) => {
      serverOutput += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      serverOutput += String(chunk);
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`Server-processen stoppede med kode ${code}\n${serverOutput}`));
      }
    });

    resolve(child);
  });
}

async function assertDeleteOrderApiWorks(baseUrl) {
  const loginResponse = await fetch(new URL("/api/auth/login", baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "owner", password: "admin123" })
  });

  if (!loginResponse.ok) {
    throw new Error(`Login fejlede ved sletnings-test: ${loginResponse.status}`);
  }

  const auth = await loginResponse.json();
  const token = auth.token;

  const createResponse = await fetch(new URL("/api/orders", baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customer: {
        name: "Sletnings Test Kunde",
        contact: "sletning@test.dk"
      },
      items: [
        {
          type: "Test ring",
          count: 1,
          priceDkk: 250,
          worker: "Test"
        }
      ]
    })
  });

  if (!createResponse.ok) {
    throw new Error(`Oprettelse af testordre fejlede: ${createResponse.status}`);
  }

  const created = await createResponse.json();
  const orderId = created.orderId;

  const deleteResponse = await fetch(new URL(`/api/admin/orders/${orderId}`, baseUrl), {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` }
  });

  const deleteData = await deleteResponse.json().catch(() => ({}));
  if (!deleteResponse.ok) {
    throw new Error(`Sletning fejlede: ${deleteResponse.status} ${deleteData.error || "ukendt fejl"}`);
  }

  const listResponse = await fetch(new URL("/api/admin/orders", baseUrl), {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!listResponse.ok) {
    throw new Error(`Liste af ordrer kunne ikke hentes efter sletning: ${listResponse.status}`);
  }

  const listData = await listResponse.json();
  if ((listData.orders || []).some((order) => order.id === orderId)) {
    throw new Error("Ordren fandtes stadig i listen efter sletning");
  }

  console.log("Delete-order API-testen bestod.");
}

async function run() {
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
    await assertDeleteOrderApiWorks(baseUrl);

    const browser = await chromium.launch({ headless: true });

    try {
      const page = await browser.newPage();

      await page.goto(`${baseUrl}/lager.html`, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForSelector(".add-btn:not([disabled])", { timeout: 10000 });
      await page.click(".add-btn:not([disabled])");

      await page.goto(`${baseUrl}/checkout.html`, { waitUntil: "networkidle", timeout: 30000 });
      await page.fill("#orderName", "Test Kunde");
      await page.fill("#orderContact", "test@example.com");
      await page.fill("#orderAddress", "Testvej 1");
      await page.fill("#orderPostCode", "8000");
      await page.fill("#orderCity", "Aarhus");

      await page.click("#submitOrderBtn");
      await page.waitForFunction(
        () => document.getElementById("checkoutMessage")?.textContent?.includes("Ordre-ID"),
        { timeout: 10000 }
      );

      const confirmationText = await page.textContent("#checkoutMessage");
      console.log("Bestillingsflow gennemført:", confirmationText.trim());
    } finally {
      await browser.close();
    }

    console.log("Ordreflow-testen bestod.");
  } catch (error) {
    console.error("Ordreflow-testen fejlede:", error.message);
    process.exitCode = 1;
  } finally {
    if (server) {
      server.kill("SIGTERM");
    }
  }
}

run();
