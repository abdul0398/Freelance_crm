import express from "express";
const router = express.Router();

import Lead from "../models/Lead.js";
import Activity from "../models/Activity.js";
import User from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";
import { checkForDuplicates } from "../services/duplicateDetector.js";

// Apply authentication middleware
router.use(requireAuth);

// Lead routes
router.get("/leads", async (req, res) => {
  try {
    const filters = {
      platform: req.query.platform,
      assigned_user_id: req.query.assigned_user_id,
      stage: req.query.stage,
      search: req.query.search,
      followup: req.query.followup,
    };

    // Pagination parameters
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    const result = await Lead.getAll(
      filters,
      req.user.role,
      req.user.user_id,
      limit,
      offset
    );

    // Don't fetch activities on initial load
    const leadsWithEmptyTimeline = result.leads.map((lead) => ({
      ...lead,
      timeline: [],
    }));

    res.json({
      leads: leadsWithEmptyTimeline,
      total: result.total,
      hasMore: offset + limit < result.total,
    });
  } catch (error) {
    console.error("Error fetching leads:", error);
    res.status(500).json({ error: "Failed to fetch leads" });
  }
});

// Lead counts per stage route - MUST come before /leads/:id
router.get("/leads/counts", async (req, res) => {
  try {
    const filters = {
      platform: req.query.platform,
      assigned_user_id: req.query.assigned_user_id,
      search: req.query.search,
      followup: req.query.followup,
    };

    const counts = await Lead.getCountsByStage(
      filters,
      req.user.role,
      req.user.user_id
    );
    res.json(counts);
  } catch (error) {
    console.error("Error fetching lead counts:", error);
    res.status(500).json({ error: "Failed to fetch lead counts" });
  }
});

router.get("/leads/:id", async (req, res) => {
  try {
    const lead = await Lead.getById(
      req.params.id,
      req.user.role,
      req.user.user_id
    );
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    const activities = await Activity.getByLeadId(req.params.id);
    lead.timeline = activities;

    res.json(lead);
  } catch (error) {
    console.error("Error fetching lead:", error);
    res.status(500).json({ error: "Failed to fetch lead" });
  }
});

// Check for duplicates before creating lead
router.post("/leads/check-duplicates", async (req, res) => {
  try {
    const duplicateCheck = await checkForDuplicates(req.body);
    res.json(duplicateCheck);
  } catch (error) {
    console.error("Error checking for duplicates:", error);
    res.status(500).json({ error: "Failed to check for duplicates" });
  }
});

router.post("/leads", async (req, res) => {
  try {
    const leadId = await Lead.create(req.body, req.user.user_id);
    res.status(201).json({ id: leadId, message: "Lead created successfully" });
  } catch (error) {
    console.error("Error creating lead:", error);
    res.status(500).json({ error: "Failed to create lead" });
  }
});

router.put("/leads/:id", async (req, res) => {
  try {
    const lead = await Lead.update(
      req.params.id,
      req.body,
      req.user.role,
      req.user.user_id
    );
    if (!lead) {
      return res.status(404).json({ error: "Lead not found or access denied" });
    }
    res.json(lead);
  } catch (error) {
    console.error("Error updating lead:", error);
    res.status(500).json({ error: "Failed to update lead" });
  }
});

router.delete("/leads/:id", async (req, res) => {
  try {
    const deleted = await Lead.delete(
      req.params.id,
      req.user.role,
      req.user.user_id
    );
    if (!deleted) {
      return res.status(404).json({ error: "Lead not found or access denied" });
    }
    res.json({ message: "Lead deleted successfully" });
  } catch (error) {
    console.error("Error deleting lead:", error);
    res.status(500).json({ error: "Failed to delete lead" });
  }
});

// Activity routes
router.get("/leads/:id/activities", async (req, res) => {
  try {
    // Check if user has access to this lead
    const lead = await Lead.getById(
      req.params.id,
      req.user.role,
      req.user.user_id
    );
    if (!lead) {
      return res.status(404).json({ error: "Lead not found or access denied" });
    }

    const activities = await Activity.getByLeadId(req.params.id);
    res.json(activities);
  } catch (error) {
    console.error("Error fetching activities:", error);
    res.status(500).json({ error: "Failed to fetch activities" });
  }
});

router.post("/leads/:id/activities", async (req, res) => {
  try {
    // Check if user has access to this lead
    const lead = await Lead.getById(
      req.params.id,
      req.user.role,
      req.user.user_id
    );
    if (!lead) {
      return res.status(404).json({ error: "Lead not found or access denied" });
    }

    const activityData = {
      ...req.body,
      lead_id: req.params.id,
      user_id: req.user.user_id,
    };

    const activityId = await Activity.create(activityData);
    res
      .status(201)
      .json({ id: activityId, message: "Activity created successfully" });
  } catch (error) {
    console.error("Error creating activity:", error);
    res.status(500).json({ error: "Failed to create activity" });
  }
});

// User routes
router.get("/users", async (req, res) => {
  try {
    const users = await User.getAll(req.user.role, req.user.user_id);
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// Stats route
router.get("/stats", async (req, res) => {
  try {
    const stats = await Lead.getStats(req.user.role, req.user.user_id);
    res.json(stats);
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

export default router;
