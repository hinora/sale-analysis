import { Schema, model, models, type Document, type Model } from "mongoose";

/**
 * AISession interface for managing AI training sessions and conversation state
 */
export interface IAISession extends Document {
  sessionId: string; // UUID
  userId: string; // Future: user identifier (for multi-user support)

  // Training data selection
  filterCriteria: {
    companies?: string[];
    categories?: string[];
    goods?: string[];
    dateFrom?: Date;
    dateTo?: Date;
  };
  trainingDataCount: number; // Number of transactions fed to AI

  // Ollama context
  ollamaModel: string; // AI model name (e.g., 'deepseek-r1:1.5b')
  ollamaContext: string; // Conversation token for maintaining context

  // Conversation history
  messages: {
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
  }[];

  // Status
  status: "pending" | "loading" | "ready" | "error";
  errorMessage?: string;

  // Expiration
  expiresAt: Date;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

const AISessionSchema = new Schema<IAISession>(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
      default: "anonymous", // MVP: single user
    },
    filterCriteria: {
      companies: [String],
      categories: [String],
      goods: [String],
      dateFrom: Date,
      dateTo: Date,
    },
    trainingDataCount: {
      type: Number,
      required: true,
      min: 0,
      max: 10000, // Constitution limit
    },
    ollamaModel: {
      type: String,
      required: true,
      default: process.env.AI_MODEL || "deepseek-r1:1.5b",
    },
    ollamaContext: {
      type: String,
      default: "",
    },
    messages: [
      {
        role: {
          type: String,
          enum: ["user", "assistant"],
          required: true,
        },
        content: {
          type: String,
          required: true,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    status: {
      type: String,
      enum: ["pending", "loading", "ready", "error"],
      required: true,
      default: "pending",
    },
    errorMessage: {
      type: String,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

// TTL index for automatic cleanup of expired sessions
AISessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AISession =
  (models.AISession as Model<IAISession>) ||
  model<IAISession>("AISession", AISessionSchema);
