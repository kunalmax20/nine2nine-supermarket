require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const dns = require("dns");
const cloudinary = require("cloudinary").v2;
const Product = require("./models/Product");

const PORT = process.env.PORT || 3000;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

dns.setServers(["8.8.8.8", "8.8.4.4"]);
const app = express();

const uploadDir = path.join(__dirname, "temp");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ dest: "temp/" });

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

mongoose
  .connect(process.env.MONGODB_URI)
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

// Helper to check admin status
const isAdmin = (phone) => ADMIN_NUMBERS.includes(String(phone));

// LOGIN
app.post("/api/login", (req, res) => {
  const { phone, password } = req.body;
  const adminStatus = isAdmin(phone) && password === ADMIN_PASSWORD;
  res.json({ success: true, isAdmin: adminStatus, phone });
});

// GET PRODUCTS
app.get("/api/products", async (req, res) => {
  try {
    const products = await Product.find({}).sort({ _id: -1 });
    res.json(products.map((p) => ({ ...p._doc, id: p._id })));
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

      if (!isAdmin(phone))
        return res
          .status(403)
          .json({ success: false, message: "Unauthorized" });
      if (!req.file)
        return res
          .status(400)
          .json({ success: false, message: "Image required" });

      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "nine2nine_products",
      });

      let parsedOptions = [];
      if (options) {
        try {
          parsedOptions = JSON.parse(options);
        } catch (e) {
          parsedOptions = [];
        }
      }

      const newProduct = new Product({
        name: name || "Unnamed Product",
        price: Number(price) || 0,
        category: category || "General",
        unit: unit || "Unit",
        emoji: result.secure_url,
        stockQuantity: Number(stockQuantity) || 0,
        options: parsedOptions,
      });

      await newProduct.save();
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      res.json({ success: true });
    } catch (err) {
      console.error("🔥 ADD ERROR:", err);
      res.status(500).json({ success: false });
    }
  },
);

// REDUCE STOCK
app.post("/api/reduce-stock", async (req, res) => {
  const { items } = req.body;
  if (!items || !Array.isArray(items))
    return res.status(400).json({ success: false });

  try {
    for (const item of items) {
      if (item.size && item.size !== "Standard") {
        const variantUpdate = await Product.updateOne(
          { _id: item.id, "options.size": item.size },
          { $inc: { "options.$.stock": -Math.abs(item.qty) } },
        );
        if (variantUpdate.modifiedCount > 0) continue;
      }
      await Product.updateOne(
        { _id: item.id },
        { $inc: { stockQuantity: -Math.abs(item.qty) } },
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// UPDATE PRODUCT
app.post(
  "/api/update-product",
  upload.single("productImage"),
  async (req, res) => {
    try {
      const { phone, id, price, stockQuantity, options, unit } = req.body;
      if (!isAdmin(phone) || !id)
        return res.status(403).json({ success: false });

      let updateData = {};
      if (price !== undefined) updateData.price = Number(price);
      if (unit !== undefined) updateData.unit = unit;
      if (options) updateData.options = JSON.parse(options);

      let updateQuery = { $set: updateData };
      if (stockQuantity !== undefined && stockQuantity !== "") {
        updateQuery.$inc = { stockQuantity: Number(stockQuantity) };
      }

      if (req.file) {
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: "nine2nine_products",
        });
        updateQuery.$set.emoji = result.secure_url;
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      }

      await Product.findByIdAndUpdate(id, updateQuery);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false });
    }
  },
);

// DELETE PRODUCT
app.post("/api/delete-product", async (req, res) => {
  const { phone, id } = req.body;
  if (!isAdmin(phone)) return res.status(403).json({ success: false });
  await Product.findByIdAndDelete(id);
  res.json({ success: true });
});

app.listen(PORT, () => console.log(`🚀 LIVE ON PORT ${PORT}`));
