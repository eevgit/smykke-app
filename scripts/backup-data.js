const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const dataDir = path.join(projectRoot, "data");
const backupRoot = path.join(projectRoot, "backups");

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function timestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate())
  ].join("") + "-" + [pad(now.getHours()), pad(now.getMinutes()), pad(now.getSeconds())].join("");
}

function copyDataFiles() {
  if (!fs.existsSync(dataDir)) {
    console.error("Data-mappen findes ikke:", dataDir);
    process.exit(1);
  }

  ensureDir(backupRoot);

  const destination = path.join(backupRoot, `data-backup-${timestamp()}`);
  ensureDir(destination);

  const files = fs.readdirSync(dataDir);
  for (const fileName of files) {
    const from = path.join(dataDir, fileName);
    const to = path.join(destination, fileName);
    if (fs.statSync(from).isFile()) {
      fs.copyFileSync(from, to);
    }
  }

  console.log("Backup oprettet:", destination);
}

copyDataFiles();
