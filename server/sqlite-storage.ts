import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq, sql } from "drizzle-orm";
import { users, plcConfigurations, type User, type PlcConfiguration, type InsertUser, type InsertPlcConfigurationDomain } from "../shared/schema";
import { type IStorage } from "./storage";
import { configFileSchema } from "../shared/schema";
import { randomUUID } from "crypto";

export class SqliteStorage implements IStorage {
  private db: ReturnType<typeof drizzle>;
  private sqlite: Database.Database;

  constructor(dbPath: string = "./database.sqlite") {
    this.sqlite = new Database(dbPath);
    this.db = drizzle(this.sqlite);
    this.initializeDatabase();
  }

  private initializeDatabase() {
    // Use Drizzle to create tables instead of raw SQL
    try {
      // Create users table
      this.db.run(sql`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT NOT NULL UNIQUE,  
          password TEXT NOT NULL
        )
      `);

      // Create plc_configurations table
      this.db.run(sql`
        CREATE TABLE IF NOT EXISTS plc_configurations (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          config_data TEXT NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } catch (error) {
      console.error("Database initialization failed:", error);
    }
  }

  async getUser(id: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const id = randomUUID();
    const newUser = { ...user, id };
    
    await this.db.insert(users).values(newUser);
    return newUser as User;
  }

  async getPlcConfiguration(id: string): Promise<PlcConfiguration | undefined> {
    const result = await this.db.select().from(plcConfigurations).where(eq(plcConfigurations.id, id));
    const config = result[0];
    
    if (config) {
      try {
        // Parse JSON string back to object with error handling
        return {
          ...config,
          config_data: JSON.parse(config.config_data as string)
        } as PlcConfiguration;
      } catch (error) {
        console.error("Failed to parse config_data JSON:", error);
        return undefined;
      }
    }
    return undefined;
  }

  async getAllPlcConfigurations(): Promise<PlcConfiguration[]> {
    const result = await this.db.select().from(plcConfigurations);
    
    // Parse JSON strings back to objects with error handling
    return result.map(config => {
      try {
        return {
          ...config,
          config_data: JSON.parse(config.config_data as string)
        } as PlcConfiguration;
      } catch (error) {
        console.error("Failed to parse config_data JSON for config", config.id, error);
        return null;
      }
    }).filter(config => config !== null) as PlcConfiguration[];
  }

  async createPlcConfiguration(config: InsertPlcConfigurationDomain): Promise<PlcConfiguration> {
    // Validate config_data before storing
    try {
      configFileSchema.parse(config.config_data);
    } catch (validationError) {
      console.error("Invalid config_data provided:", validationError);
      throw new Error("Invalid configuration data");
    }

    const id = randomUUID();
    const created_at = new Date().toISOString();
    
    // Convert config_data object to JSON string for SQLite storage
    const configToInsert = {
      ...config,
      id,
      created_at,
      description: config.description || null,
      config_data: JSON.stringify(config.config_data)
    };

    await this.db.insert(plcConfigurations).values(configToInsert);
    
    return {
      ...configToInsert,
      config_data: config.config_data // Return with parsed object
    } as PlcConfiguration;
  }

  async updatePlcConfiguration(id: string, updateData: Partial<InsertPlcConfigurationDomain>): Promise<PlcConfiguration | undefined> {
    try {
      // Check if any fields are provided
      if (Object.keys(updateData).length === 0) {
        return this.getPlcConfiguration(id);
      }

      // Build update object only with provided keys
      const updateToApply: any = {};
      if (updateData.name !== undefined) updateToApply.name = updateData.name;
      if (updateData.description !== undefined) updateToApply.description = updateData.description;
      if (updateData.config_data !== undefined) {
        // Validate config_data before storing
        try {
          configFileSchema.parse(updateData.config_data);
          updateToApply.config_data = JSON.stringify(updateData.config_data);
        } catch (validationError) {
          console.error("Invalid config_data provided:", validationError);
          return undefined;
        }
      }

      await this.db.update(plcConfigurations)
        .set(updateToApply)
        .where(eq(plcConfigurations.id, id));

      return this.getPlcConfiguration(id);
    } catch (error) {
      console.error("Failed to update PLC configuration:", error);
      return undefined;
    }
  }

  async deletePlcConfiguration(id: string): Promise<boolean> {
    try {
      // Check if record exists first
      const existing = await this.getPlcConfiguration(id);
      if (!existing) return false;

      await this.db.delete(plcConfigurations).where(eq(plcConfigurations.id, id));
      return true;
    } catch (error) {
      console.error("Failed to delete PLC configuration:", error);
      return false;
    }
  }
}