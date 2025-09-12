import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import { users, plcConfigurations, type User, type PlcConfiguration, type InsertUser, type InsertPlcConfiguration } from "./sqlite-schema";
import { type IStorage } from "./storage";
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
    // Create tables if they don't exist
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL
      )
    `);

    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS plc_configurations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        config_data TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
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
      // Parse JSON string back to object
      return {
        ...config,
        config_data: JSON.parse(config.config_data)
      } as PlcConfiguration;
    }
    return undefined;
  }

  async getAllPlcConfigurations(): Promise<PlcConfiguration[]> {
    const result = await this.db.select().from(plcConfigurations);
    
    // Parse JSON strings back to objects
    return result.map(config => ({
      ...config,
      config_data: JSON.parse(config.config_data)
    })) as PlcConfiguration[];
  }

  async createPlcConfiguration(config: InsertPlcConfiguration): Promise<PlcConfiguration> {
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

  async updatePlcConfiguration(id: string, updateData: Partial<InsertPlcConfiguration>): Promise<PlcConfiguration | undefined> {
    // Convert config_data to JSON string if present
    const updateToApply = {
      ...updateData,
      ...(updateData.config_data && { config_data: JSON.stringify(updateData.config_data) })
    };

    await this.db.update(plcConfigurations)
      .set(updateToApply)
      .where(eq(plcConfigurations.id, id));

    // Return the updated configuration
    return this.getPlcConfiguration(id);
  }

  async deletePlcConfiguration(id: string): Promise<boolean> {
    const result = await this.db.delete(plcConfigurations).where(eq(plcConfigurations.id, id));
    return (result as any).changes > 0;
  }
}