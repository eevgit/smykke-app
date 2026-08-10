const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const newPassword = process.argv[2];
if (!newPassword) {
  console.error("Usage: node scripts/reset-owner-password.js <newPassword>");
  process.exit(1);
}

const usersPath = path.join(__dirname, "..", "data", "users.json");
const users = JSON.parse(fs.readFileSync(usersPath, "utf8"));
const owner = users.find((u) => u.username === "owner");

if (!owner) {
  console.error("User 'owner' not found.");
  process.exit(1);
}

const salt = crypto.randomBytes(16).toString("hex");
const hash = crypto.scryptSync(newPassword, salt, 64).toString("hex");

owner.salt = salt;
owner.hash = hash;

fs.writeFileSync(usersPath, JSON.stringify(users, null, 2), "utf8");
console.log("Password reset completed for user 'owner'.");
