import { sql } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";

export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const plcConfigurations = sqliteTable("plc_configurations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  config_data: text("config_data").notNull(), // JSON stored as text in SQLite
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

export type InsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type PlcConfiguration = typeof plcConfigurations.$inferSelect;
export type InsertPlcConfiguration = typeof insertPlcConfigSchema._type;