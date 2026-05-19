const mongoose = require("mongoose");

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
  status: { type: String, default: "Pending" }, // "Pending", "Approved", or "Cancelled"
  date: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Order", OrderSchema);
