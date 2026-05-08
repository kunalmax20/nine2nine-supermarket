const mongoose = require("mongoose");

const ReviewSchema = new mongoose.Schema({
  userName: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true },
  reply: { type: String, default: "" }, // Admin reply
  date: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Review", ReviewSchema);
