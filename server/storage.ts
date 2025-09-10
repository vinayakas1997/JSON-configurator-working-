import { type User, type InsertUser, type PlcConfiguration, type InsertPlcConfiguration } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getPlcConfiguration(id: string): Promise<PlcConfiguration | undefined>;
  getAllPlcConfigurations(): Promise<PlcConfiguration[]>;
  createPlcConfiguration(config: InsertPlcConfiguration): Promise<PlcConfiguration>;
  updatePlcConfiguration(id: string, config: Partial<InsertPlcConfiguration>): Promise<PlcConfiguration | undefined>;
  deletePlcConfiguration(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private plcConfigurations: Map<string, PlcConfiguration>;

  constructor() {
    this.users = new Map();
    this.plcConfigurations = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getPlcConfiguration(id: string): Promise<PlcConfiguration | undefined> {
    return this.plcConfigurations.get(id);
  }

  async getAllPlcConfigurations(): Promise<PlcConfiguration[]> {
    return Array.from(this.plcConfigurations.values());
  }

  async createPlcConfiguration(insertConfig: InsertPlcConfiguration): Promise<PlcConfiguration> {
    const id = randomUUID();
    const config: PlcConfiguration = {
      ...insertConfig,
      id,
      created_at: new Date().toISOString(),
      description: insertConfig.description || null,
    };
    this.plcConfigurations.set(id, config);
    return config;
  }

  async updatePlcConfiguration(id: string, updateData: Partial<InsertPlcConfiguration>): Promise<PlcConfiguration | undefined> {
    const existingConfig = this.plcConfigurations.get(id);
    if (!existingConfig) {
      return undefined;
    }
    
    const updatedConfig: PlcConfiguration = {
      ...existingConfig,
      ...updateData,
    };
    this.plcConfigurations.set(id, updatedConfig);
    return updatedConfig;
  }

  async deletePlcConfiguration(id: string): Promise<boolean> {
    return this.plcConfigurations.delete(id);
  }
}

export const storage = new MemStorage();
