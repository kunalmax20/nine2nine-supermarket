const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  price: {
    type: Number,
    default: 0,
    set: (v) => Math.round(v),
  },
  category: { type: String, default: "General" },
  emoji: { type: String },
  unit: { type: String, default: "Unit" },
  stockQuantity: {
    type: Number,
    default: 0,
    set: (v) => parseInt(v) || 0,
  },
  outOfStock: { type: Boolean, default: false },
  options: [{ unit: String, price: Number }],
  reviews: [
    {
      user: String,
      rating: Number,
      comment: String,
      date: { type: String, default: () => new Date().toLocaleDateString() },
    },
  ],
});

// FIXED: Removed 'next'. In modern Mongoose, if you don't use 'next',
// and the function is synchronous, it proceeds automatically.
productSchema.pre("save", function () {
  this.outOfStock = this.stockQuantity <= 0;
  if (this.stockQuantity < 0) this.stockQuantity = 0;
});

module.exports = mongoose.model("Product", productSchema);
