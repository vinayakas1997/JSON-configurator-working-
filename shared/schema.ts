import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const addressMappingSchema = z.object({
  plc_reg_add: z.string().min(1, "PLC register address is required"),
  data_type: z.enum(["int16", "int32", "float32", "bool", "string", "CHANNEL", "BOOL", "WORD", "UDINT", "DWORD", "INT", "REAL", "LREAL"]),
  opcua_reg_add: z.string().min(1, "OPC UA register address is required"),
  description: z.string().optional(),
  metadata: z.object({
    bit_count: z.number(),
    bit_mappings: z.record(z.object({
      address: z.string(),
      description: z.string(),
      bit_position: z.number()
    }))
  }).optional()
});

export const plcConfigSchema = z.object({
  plc_name: z.string().min(1, "PLC name is required"),
  plc_ip: z.string().ip("Invalid IP address"),
  opcua_url: z.string().url("Invalid OPC UA URL"),
  address_mappings: z.array(addressMappingSchema)
});

export const configFileSchema = z.object({
  plcs: z.array(plcConfigSchema)
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const plcConfigurations = pgTable("plc_configurations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  config_data: jsonb("config_data").notNull(),
  created_at: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertPlcConfigSchema = createInsertSchema(plcConfigurations).omit({
  id: true,
  created_at: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type PlcConfiguration = typeof plcConfigurations.$inferSelect;
export type InsertPlcConfiguration = z.infer<typeof insertPlcConfigSchema>;
export type AddressMapping = z.infer<typeof addressMappingSchema>;
export type PlcConfig = z.infer<typeof plcConfigSchema>;
export type ConfigFile = z.infer<typeof configFileSchema>;
