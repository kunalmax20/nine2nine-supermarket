const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

// 🔒 ADMIN CONFIGURATION
const ADMIN_NUMBERS = ["919057563838"]; // Put your 10-digit number here

app.use(express.json());
app.use(express.static("public"));

const DB_PATH = path.join(__dirname, "db.json");

if (!fs.existsSync(DB_PATH)) {
  const initialData = { products: [] };
  fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2));
}

app.post("/api/login", (req, res) => {
  const { phone } = req.body;
  if (!phone || phone.length < 10) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid phone number." });
  }
  const isAdmin = ADMIN_NUMBERS.includes(phone);
  res.json({ success: true, isAdmin, phone });
});

app.get("/api/products", (req, res) => {
  try {
    const data = fs.readFileSync(DB_PATH, "utf8");
    res.json(JSON.parse(data).products);
  } catch (err) {
    res.status(500).json({ error: "Failed to read database" });
  }
});

app.post("/api/products", (req, res) => {
  try {
    const { phone, products } = req.body;
    if (!ADMIN_NUMBERS.includes(phone)) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }
    fs.writeFileSync(DB_PATH, JSON.stringify({ products }, null, 2));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to save" });
  }
});

app.listen(PORT, () => {
  console.log(`---`);
  console.log(`🚀 NINE2NINE SECURE SERVER IS LIVE`);
  console.log(`🔗 Local URL: http://localhost:${PORT}`);
  console.log(`---`);
});
