import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPlcConfigSchema, configFileSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Get all PLC configurations
  app.get("/api/plc-configurations", async (req, res) => {
    try {
      const configurations = await storage.getAllPlcConfigurations();
      res.json(configurations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch configurations" });
    }
  });

  // Get a specific PLC configuration
  app.get("/api/plc-configurations/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const configuration = await storage.getPlcConfiguration(id);
      
      if (!configuration) {
        return res.status(404).json({ message: "Configuration not found" });
      }
      
      res.json(configuration);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch configuration" });
    }
  });

  // Create a new PLC configuration
  app.post("/api/plc-configurations", async (req, res) => {
    try {
      const validatedData = insertPlcConfigSchema.parse(req.body);
      
      // Validate the config_data structure
      if (validatedData.config_data) {
        configFileSchema.parse(validatedData.config_data);
      }
      
      const configuration = await storage.createPlcConfiguration(validatedData);
      res.status(201).json(configuration);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Failed to create configuration" });
    }
  });

  // Update a PLC configuration
  app.put("/api/plc-configurations/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertPlcConfigSchema.partial().parse(req.body);
      
      // Validate the config_data structure if provided
      if (validatedData.config_data) {
        configFileSchema.parse(validatedData.config_data);
      }
      
      const configuration = await storage.updatePlcConfiguration(id, validatedData);
      
      if (!configuration) {
        return res.status(404).json({ message: "Configuration not found" });
      }
      
      res.json(configuration);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Failed to update configuration" });
    }
  });

  // Delete a PLC configuration
  app.delete("/api/plc-configurations/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deletePlcConfiguration(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Configuration not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete configuration" });
    }
  });

  // Validate configuration data
  app.post("/api/plc-configurations/validate", async (req, res) => {
    try {
      const validatedData = configFileSchema.parse(req.body);
      res.json({ valid: true, data: validatedData });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          valid: false,
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ valid: false, message: "Validation failed" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
