require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const dns = require("dns");
const cloudinary = require("cloudinary").v2;
const Product = require("./models/Product");
const Review = require("./models/Review");

// Automatically creates schema registration if models/Order.js doesn't exist yet
let Order;
try {
  Order = require("./models/Order");
} catch (e) {
  const OrderSchema = new mongoose.Schema({
    customerPhone: { type: String, required: true },
    items: [
      {
        id: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        name: { type: String, required: true },
        size: { type: String, required: true },
        qty: { type: Number, required: true },
        price: { type: Number, required: true },
      },
    ],
    totalAmount: { type: Number, required: true },
    status: { type: String, default: "Pending" },
    date: { type: Date, default: Date.now },
  });
  Order = mongoose.model("Order", OrderSchema);
}

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
  const cleanPhone = String(phone).replace(/\D/g, "");
  const adminStatus = isAdmin(cleanPhone) && password === ADMIN_PASSWORD;

  if (!adminStatus && password) {
    return res.json({
      success: false,
      message: "Wrong admin password",
    });
  }

  res.json({
    success: true,
    isAdmin: adminStatus,
    phone: cleanPhone,
  });
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
      res.status(500).json({ success: false, message: err.message });
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
      const { phone, id, price, stockQuantity, options, unit, category, name } =
        req.body;
      if (!isAdmin(phone) || !id)
        return res.status(403).json({ success: false });

      let updateData = {};
      if (name !== undefined) updateData.name = name;
      if (price !== undefined && price !== "") updateData.price = Number(price);
      if (unit !== undefined) updateData.unit = unit;
      if (category !== undefined) updateData.category = category;
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

// REVIEWS API
app.get("/api/reviews", async (req, res) => {
  try {
    const reviews = await Review.find().sort({ date: -1 });
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.post("/api/add-review", async (req, res) => {
  try {
    const newReview = new Review(req.body);
    await newReview.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.post("/api/reply-review", async (req, res) => {
  const { phone, reviewId, replyText } = req.body;
  if (!isAdmin(phone)) return res.status(403).send("Unauthorized");
  await Review.findByIdAndUpdate(reviewId, { reply: replyText });
  res.json({ success: true });
});

app.post("/api/delete-review", async (req, res) => {
  const { phone, reviewId } = req.body;
  if (!isAdmin(phone)) return res.status(403).send("Unauthorized");
  await Review.findByIdAndDelete(reviewId);
  res.json({ success: true });
});

// ==========================================================
// NEW ORDER PIPELINE ENDPOINTS (ADMIN-CONTROLLED INVENTORY)
// ==========================================================

// PUBLIC: Pushes shopping cart contents silently into MongoDB database archive entries
app.post("/api/create-pending-order", async (req, res) => {
  try {
    const { customerPhone, items, totalAmount } = req.body;
    const newOrder = new Order({
      customerPhone,
      items,
      totalAmount,
      status: "Pending",
    });
    await newOrder.save();
    res.json({ success: true, orderId: newOrder._id });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// ADMIN: Grabs pending dashboard listings metrics data blocks
app.get("/api/admin/orders", async (req, res) => {
  try {
    const { phone } = req.query;
    if (!isAdmin(phone)) return res.status(403).json([]);
    const orders = await Order.find({ status: "Pending" }).sort({ date: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json([]);
  }
});

// ADMIN: Deducts physical store stock limits safely upon administrative confirmation
app.post("/api/admin/approve-order", async (req, res) => {
  try {
    const { phone, orderId } = req.body;
    if (!isAdmin(phone)) return res.status(403).json({ success: false });

    const order = await Order.findById(orderId);
    if (!order || order.status !== "Pending")
      return res
        .status(400)
        .json({ success: false, message: "Order processed or missing" });

    // Deducts the variant or main product stock levels precisely
    for (const item of order.items) {
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

    order.status = "Approved";
    await order.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// ADMIN: Drops prank or incorrect balance configurations cleanly out of view metrics
app.post("/api/admin/cancel-order", async (req, res) => {
  try {
    const { phone, orderId } = req.body;
    if (!isAdmin(phone)) return res.status(403).json({ success: false });

    await Order.findByIdAndUpdate(orderId, { status: "Cancelled" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.listen(PORT, () => console.log(`🚀 LIVE ON PORT ${PORT}`));
  