import { sql } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const addressMappingSchema = z.object({
  plc_reg_add: z.string().min(1, "PLC register address is required"),
  data_type: z.enum(["int16", "int32", "float32", "bool", "string", "CHANNEL", "BOOL", "WORD", "UDINT", "DWORD", "INT", "REAL", "LREAL", "modified channel"]),
  opcua_reg_add: z.string().min(1, "OPC UA register address is required"),
  description: z.string().optional(),
  bit_list: z.array(z.number()).optional(), // Array of bit positions for efficient highlighting
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
  plc_no: z.number().min(1, "PLC number is required"),
  plc_ip: z.string().ip("Invalid IP address"),
  opcua_url: z.string().url("Invalid OPC UA URL"),
  address_mappings: z.array(addressMappingSchema)
});

export const configFileSchema = z.object({
  plcs: z.array(plcConfigSchema),
  // Additional fields for session state restoration
  plc_no: z.number().optional(),
  config_file_name: z.string().optional(),
  config_description: z.string().optional(),
  selected_memory_areas: z.array(z.string()).optional(),
  selected_registers: z.array(z.number()).optional(),
  deselected_keys: z.array(z.string()).optional(),
  parse_result: z.any().optional() // ParseResult type - using any for flexibility
});

// SQLite tables for the actual implementation
export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const plcConfigurations = sqliteTable("plc_configurations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  config_data: text("config_data").notNull(), // JSON stored as text
  created_at: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

// Database insert schema (config_data as string)
export const insertPlcConfigSchema = createInsertSchema(plcConfigurations).omit({
  id: true,
  created_at: true,
});

// Domain insert schema (config_data as object)
export const insertPlcConfigDomainSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().nullable().optional(),
  config_data: configFileSchema
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Database row type (config_data is string in SQLite)
export type PlcConfigurationRow = typeof plcConfigurations.$inferSelect;

// Domain type (config_data is parsed ConfigFile object) 
export type PlcConfiguration = Omit<PlcConfigurationRow, 'config_data'> & {
  config_data: ConfigFile;
};

// Database insert type (string)
export type InsertPlcConfiguration = z.infer<typeof insertPlcConfigSchema>;
// Domain insert type (object)
export type InsertPlcConfigurationDomain = z.infer<typeof insertPlcConfigDomainSchema>;
export type AddressMapping = z.infer<typeof addressMappingSchema>;
export type PlcConfig = z.infer<typeof plcConfigSchema>;
export type ConfigFile = z.infer<typeof configFileSchema>;
