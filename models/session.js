import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
  },
  modelName: {
    type: String,
    required: true,
  },
  modelProvider: {
    type: String,
    default: "huggingface"
  },
  baseUrl: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ["loading", "ready", "error"],
    default: "loading",
  },
  initializedAt: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 60 * 60 * 24, // 24 hours auto-delete
  },
});

export default mongoose.model("Session", sessionSchema);
