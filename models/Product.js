const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },

  category: {
    type: String,
    default: "General",
  },

  emoji: {
    type: String,
    default: "",
  },

  unit: {
    type: String,
    default: "Unit",
  },

  // Base pricing/stock
  price: {
    type: Number,
    default: 0,
    set: (v) => Math.round(Number(v) || 0),
  },

  stockQuantity: {
    type: Number,
    default: 0,
    set: (v) => {
      const num = parseInt(v);
      return isNaN(num) ? 0 : num;
    },
  },

  outOfStock: {
    type: Boolean,
    default: false,
  },

  // Product variants
  options: [
    {
      size: {
        type: String,
        default: "",
      },

      price: {
        type: Number,
        default: 0,
      },

      stock: {
        type: Number,
        default: 0,
      },
    },
  ],

  // Reviews
  reviews: [
    {
      user: String,
      rating: Number,
      comment: String,

      date: {
        type: String,
        default: () => new Date().toLocaleDateString(),
      },
    },
  ],
});

// SAFE STOCK HANDLER
productSchema.pre("save", async function () {
  // Prevent negative stock
  if (this.stockQuantity < 0) {
    this.stockQuantity = 0;
  }

  // Ensure options array exists
  if (!Array.isArray(this.options)) {
    this.options = [];
  }

  // Prevent negative variant stock
  this.options = this.options.map((opt) => ({
    ...opt,
    stock: opt.stock < 0 ? 0 : Number(opt.stock) || 0,
    price: Number(opt.price) || 0,
  }));

  // Check stock availability
  const hasVariantStock = this.options.some((opt) => Number(opt.stock) > 0);

  if (this.options.length > 0) {
    this.outOfStock = !hasVariantStock;
  } else {
    this.outOfStock = this.stockQuantity <= 0;
  }
});

module.exports = mongoose.model("Product", productSchema);
