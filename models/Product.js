const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  category: { type: String, default: "General" },
  emoji: { type: String },
  unit: { type: String, default: "Unit" }, // e.g., "pcs", "kg", "pkt"

  // Base pricing/stock (used if no options are provided)
  price: {
    type: Number,
    default: 0,
    set: (v) => Math.round(v),
  },
  stockQuantity: {
    type: Number,
    default: 0,
    set: (v) => parseInt(v) || 0,
  },
  outOfStock: { type: Boolean, default: false },

  // Variants for Blinkit-style selection
  options: [
    {
      size: String, // e.g., "150ml", "500ml", "1L"
      price: Number,
      stock: { type: Number, default: 0 },
    },
  ],

  reviews: [
    {
      user: String,
      rating: Number,
      comment: String,
      date: { type: String, default: () => new Date().toLocaleDateString() },
    },
  ],
});

// Middleware to handle stock logic before saving
productSchema.pre("save", function (next) {
  if (this.stockQuantity < 0) this.stockQuantity = 0;

  // Check if any variant has stock
  const hasOptionStock = this.options.some((opt) => opt.stock > 0);

  if (this.options.length > 0) {
    this.outOfStock = !hasOptionStock;
  } else {
    this.outOfStock = this.stockQuantity <= 0;
  }

  next();
});

module.exports = mongoose.model("Product", productSchema);
