import mongoose from "mongoose";

interface ConnectionOptions {
  maxRetries?: number;
  retryDelay?: number;
}

class DatabaseConnection {
  private static instance: DatabaseConnection;
  private isConnected: boolean = false;
  private connectionPromise: Promise<typeof mongoose> | null = null;

  private constructor() {}

  static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  async connect(options: ConnectionOptions = {}): Promise<typeof mongoose> {
    // If already connected, return immediately
    if (this.isConnected && mongoose.connection.readyState === 1) {
      return mongoose;
    }

    // If connection is in progress, return the existing promise
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    const { maxRetries = 5, retryDelay = 2000 } = options;
    const mongoUri =
      process.env.MONGODB_URI || "mongodb://mongodb:27017/export-goods";

    this.connectionPromise = this.connectWithRetry(
      mongoUri,
      maxRetries,
      retryDelay,
    );

    try {
      const result = await this.connectionPromise;
      this.isConnected = true;
      return result;
    } catch (error) {
      this.connectionPromise = null;
      throw error;
    }
  }

  private async connectWithRetry(
    uri: string,
    maxRetries: number,
    retryDelay: number,
    attempt: number = 1,
  ): Promise<typeof mongoose> {
    try {
      console.log(
        `[MongoDB] Connecting to database (attempt ${attempt}/${maxRetries})...`,
      );

      const connection = await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      console.log(`[MongoDB] Successfully connected to database`);

      // Setup connection event handlers
      mongoose.connection.on("error", (error: Error) => {
        console.error("[MongoDB] Connection error:", error);
        this.isConnected = false;
      });

      mongoose.connection.on("disconnected", () => {
        console.warn("[MongoDB] Disconnected from database");
        this.isConnected = false;
      });

      mongoose.connection.on("reconnected", () => {
        console.log("[MongoDB] Reconnected to database");
        this.isConnected = true;
      });

      return connection;
    } catch (error) {
      console.error(`[MongoDB] Connection attempt ${attempt} failed:`, error);

      if (attempt >= maxRetries) {
        throw new Error(
          `Failed to connect to MongoDB after ${maxRetries} attempts: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }

      // Wait before retrying
      console.log(`[MongoDB] Retrying in ${retryDelay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, retryDelay));

      // Exponential backoff for retries
      return this.connectWithRetry(
        uri,
        maxRetries,
        retryDelay * 1.5,
        attempt + 1,
      );
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await mongoose.disconnect();
      this.isConnected = false;
      this.connectionPromise = null;
      console.log("[MongoDB] Disconnected from database");
    }
  }

  getConnectionState(): number {
    return mongoose.connection.readyState;
  }

  isHealthy(): boolean {
    return this.isConnected && mongoose.connection.readyState === 1;
  }
}

// Export singleton instance
export const dbConnection = DatabaseConnection.getInstance();

// Helper function for API routes
export async function connectToDatabase(): Promise<typeof mongoose> {
  return dbConnection.connect();
}

// Helper function to ensure connection for API routes
export async function withDatabase<T>(handler: () => Promise<T>): Promise<T> {
  await connectToDatabase();
  return handler();
}

export default dbConnection;
