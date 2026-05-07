require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const dns = require("dns");
const cloudinary = require("cloudinary").v2;

const Product = require("./models/Product");

// 1. DEFINE PORT AT THE TOP
const PORT = process.env.PORT || 3000;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

dns.setServers(["8.8.8.8", "8.8.4.4"]);
const app = express();

// REMOVED: app.listen from here (it was line 20)

const uploadDir = path.join(__dirname, "temp");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ dest: "temp/" });

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

mongoose
  .connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  })
  .then(() => console.log("✅ nine2nine Database Connected!"))
  .catch((err) => console.error("❌ DB Error:", err.message));

const ADMIN_NUMBERS = [
  "919057563838",
  "9057563838",
  "919414411960",
  "9414411960",
  "919509750929",
  "9509750929",
];
const ADMIN_PASSWORD = "nine2nine";

// LOGIN
app.post("/api/login", (req, res) => {
  const { phone, password } = req.body;
  const isAdmin = ADMIN_NUMBERS.includes(phone);
  if (isAdmin && password === ADMIN_PASSWORD)
    return res.json({ success: true, isAdmin: true, phone });
  res.json({ success: true, isAdmin: false, phone });
});

// GET PRODUCTS
app.get("/api/products", async (req, res) => {
  try {
    const products = await Product.find({}).sort({ _id: -1 });
    const transformed = products.map((p) => ({
      ...p._doc,
      id: p._id,
    }));
    res.json(transformed);
  } catch (err) {
    res.status(500).json({ error: "Fetch failed" });
  }
});

// ADD PRODUCT
app.post(
  "/api/add-product",
  upload.single("productImage"),
  async (req, res) => {
    try {
      const { phone, name, price, stockQuantity, category, options, unit } =
        req.body;
      if (!ADMIN_NUMBERS.includes(phone))
        return res.status(403).json({ success: false });

      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "nine2nine_products",
      });

      const newProduct = new Product({
        name,
        price: Number(price) || 0,
        category: category || "General",
        unit: unit || "Unit",
        emoji: result.secure_url,
        stockQuantity: Number(stockQuantity) || 0,
        options: options ? JSON.parse(options) : [],
        reviews: [],
      });

      await newProduct.save();
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false });
    }
  },
);

// REDUCE STOCK
app.post("/api/reduce-stock", async (req, res) => {
  const { items } = req.body;
  try {
    await Promise.all(
      items.map((item) =>
        Product.findByIdAndUpdate(item.id, {
          $inc: { stockQuantity: -item.qty },
        }),
      ),
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Stock update error:", err);
    res.status(500).json({ success: false });
  }
});

// UPDATE PRODUCT
app.post(
  "/api/update-product",
  upload.single("productImage"),
  async (req, res) => {
    try {
      const { phone, id, price, stockQuantity } = req.body;

      console.log("--- Update Request Received ---");
      if (!ADMIN_NUMBERS.includes(phone) || !id) {
        return res.status(403).json({ success: false });
      }

      let updateQuery = {};
      if (price !== undefined && price !== "") {
        updateQuery.$set = {
          ...(updateQuery.$set || {}),
          price: Number(price),
        };
      }
      if (stockQuantity !== undefined && stockQuantity !== "") {
        updateQuery.$inc = { stockQuantity: Number(stockQuantity) };
      }

      if (req.file) {
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: "nine2nine_products",
        });
        updateQuery.$set = {
          ...(updateQuery.$set || {}),
          emoji: result.secure_url,
        };
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      }

      const updatedProduct = await Product.findByIdAndUpdate(id, updateQuery, {
        new: true,
      });

      if (updatedProduct) {
        res.json({ success: true });
      } else {
        res.status(404).json({ success: false });
      }
    } catch (err) {
      console.error("🔥 SERVER ERROR:", err.message);
      res.status(500).json({ success: false });
    }
  },
);

// DELETE PRODUCT
app.post("/api/delete-product", async (req, res) => {
  try {
    const { phone, id } = req.body;
    if (!ADMIN_NUMBERS.includes(phone))
      return res.status(403).json({ success: false });
    await Product.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ success: false });
  }
});

// 2. ONE SINGLE LISTEN COMMAND AT THE BOTTOM
app.listen(PORT, () => console.log(`🚀 LIVE ON PORT ${PORT}`));
git add server.js
git commit -m "Fix: move PORT definition and remove duplicate listener"
git push origin main