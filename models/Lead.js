import db from "../config/database.js";

export default class Lead {
  static async getAll(filters = {}, userRole = "user", userId = null, limit = null, offset = 0) {
    // Build WHERE clause
    let whereClause = "WHERE l.deleted_at IS NULL";
    const params = [];

    // Apply assigned_status filter (for Prospect user with custom tabs)
    if (filters.assigned_status) {
      if (filters.assigned_status === "unassigned") {
        whereClause += " AND l.assigned_user_id IS NULL";
      } else if (filters.assigned_status === "assigned") {
        whereClause += " AND l.assigned_user_id IS NOT NULL";
      }
      // User 7 (Prospect) can see ALL leads when using assigned_status filter
      // Other non-admin users with assigned_status filter should see leads created by them
      if (userRole !== "admin" && userId !== 7) {
        whereClause += " AND l.created_by = ?";
        params.push(userId);
      }
    } else {
      // Role-based filtering (regular flow)
      if (userRole !== "admin") {
        if (userId === 6 || userId === 7) {
          // For user 6 (Leadgen) and user 7 (Prospect), show leads assigned to them OR created by them
          whereClause += " AND (l.assigned_user_id = ? OR l.created_by = ?)";
          params.push(userId, userId);
        } else {
          // For other users, only show leads assigned to them
          whereClause += " AND l.assigned_user_id = ?";
          params.push(userId);
        }
      }
    }

    // Apply other filters
    if (filters.platform) {
      whereClause += " AND l.platform = ?";
      params.push(filters.platform);
    }

    if (filters.assigned_user_id) {
      whereClause += " AND l.assigned_user_id = ?";
      params.push(filters.assigned_user_id);
    }

    if (filters.stage) {
      whereClause += " AND l.stage = ?";
      params.push(filters.stage);
    }

    if (filters.search) {
      whereClause += " AND (l.contact_name LIKE ? OR l.company LIKE ?)";
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    // Handle follow-up filters
    if (filters.followup) {
      const today = new Date().toISOString().split("T")[0];

      switch (filters.followup) {
        case "overdue":
          whereClause += " AND l.followup_date < ?";
          params.push(today);
          break;
        case "today":
          whereClause += " AND l.followup_date = ?";
          params.push(today);
          break;
        case "week":
          const weekFromNow = new Date();
          weekFromNow.setDate(weekFromNow.getDate() + 7);
          whereClause += " AND l.followup_date BETWEEN ? AND ?";
          params.push(today, weekFromNow.toISOString().split("T")[0]);
          break;
        case "none":
          whereClause += " AND l.followup_date IS NULL";
          break;
      }
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM leads l
      ${whereClause}
    `;
    const [countResult] = await db.execute(countQuery, params);
    const total = countResult[0].total;

    // Get paginated leads
    let query = `
      SELECT
        l.id,
        l.contact_name,
        l.company,
        l.platform,
        l.deal_value,
        l.followup_date,
        l.notes,
        l.stage,
        l.created_at,
        l.updated_at,
        u.name as assigned_user_name,
        u.id as assigned_user_id,
        l.created_by,
        creator.name as created_by_name
      FROM leads l
      LEFT JOIN users u ON l.assigned_user_id = u.id
      LEFT JOIN users creator ON l.created_by = creator.id
      ${whereClause}
      ORDER BY l.updated_at DESC
    `;

    // Create a copy of params for the main query to avoid modifying the original
    const queryParams = [...params];

    // Add pagination if limit is provided
    if (limit !== null) {
      // Ensure limit and offset are integers, not strings
      const limitInt = parseInt(limit, 10);
      const offsetInt = parseInt(offset, 10);
      query += ` LIMIT ${limitInt} OFFSET ${offsetInt}`;
    }

    const [rows] = await db.execute(query, queryParams);

    return {
      leads: rows,
      total: total
    };
  }

  static async getById(id, userRole = "user", userId = null) {
    let query = `
      SELECT
        l.*,
        u.name as assigned_user_name,
        creator.name as created_by_name
      FROM leads l
      LEFT JOIN users u ON l.assigned_user_id = u.id
      LEFT JOIN users creator ON l.created_by = creator.id
      WHERE l.id = ? AND l.deleted_at IS NULL
    `;

    const params = [id];

    // Role-based filtering
    if (userRole !== "admin" && userId !== 7) {
      // User 7 (Prospect) can access ALL leads like admin
      if (userId === 6) {
        // For user 6 (Leadgen), allow access to leads assigned to them OR created by them
        query += " AND (l.assigned_user_id = ? OR l.created_by = ?)";
        params.push(userId, userId);
      } else {
        // For other users, only allow access to leads assigned to them
        query += " AND l.assigned_user_id = ?";
        params.push(userId);
      }
    }

    const [rows] = await db.execute(query, params);
    return rows[0];
  }

  static async create(leadData, createdBy) {
    const {
      contact_name,
      company,
      platform,
      deal_value,
      assigned_user_id,
      followup_date,
      notes,
      stage = "cold",
    } = leadData;

    let finalAssignedUserId = assigned_user_id;

    // If created by user 6 (Leadgen) or user 7 (Prospect), set assigned_user_id to null
    if (createdBy === 6 || createdBy === 7) {
      finalAssignedUserId = null;
    }

    const [result] = await db.execute(
      `
      INSERT INTO leads (
        contact_name, company, platform, deal_value,
        assigned_user_id, followup_date, notes, stage, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        contact_name,
        company,
        platform,
        deal_value || 0,
        finalAssignedUserId || null,
        followup_date || null,
        notes,
        stage,
        createdBy,
      ]
    );

    return result.insertId;
  }

  static async update(id, leadData, userRole = "user", userId = null) {
    const {
      contact_name,
      company,
      platform,
      deal_value,
      assigned_user_id,
      followup_date,
      notes,
      stage,
    } = leadData;

    let query = `
      UPDATE leads SET
        contact_name = ?,
        company = ?,
        platform = ?,
        deal_value = ?,
        assigned_user_id = ?,
        followup_date = ?,
        notes = ?,
        stage = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND deleted_at IS NULL
    `;

    const params = [
      contact_name,
      company,
      platform,
      deal_value || 0,
      assigned_user_id || null,
      followup_date ? new Date(followup_date) : null,
      notes,
      stage,
      id,
    ];

    // Role-based filtering
    if (userRole !== "admin" && userId !== 7) {
      // User 7 (Prospect) can update ALL leads like admin
      if (userId === 6) {
        // For user 6 (Leadgen), allow updating leads assigned to them OR created by them
        query += " AND (assigned_user_id = ? OR created_by = ?)";
        params.push(userId, userId);
      } else {
        // For other users, only allow updating leads assigned to them
        query += " AND assigned_user_id = ?";
        params.push(userId);
      }
    }

    const [result] = await db.execute(query, params);

    if (result.affectedRows === 0) {
      throw new Error("Lead not found or access denied");
    }

    return this.getById(id, userRole, userId);
  }

  static async delete(id, userRole = "user", userId = null) {
    let query =
      "UPDATE leads SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL";
    const params = [id];

    // Role-based filtering
    if (userRole !== "admin" && userId !== 7) {
      // User 7 (Prospect) can delete ALL leads like admin
      if (userId === 6) {
        // For user 6 (Leadgen), allow deleting leads assigned to them OR created by them
        query += " AND (assigned_user_id = ? OR created_by = ?)";
        params.push(userId, userId);
      } else {
        // For other users, only allow deleting leads assigned to them
        query += " AND assigned_user_id = ?";
        params.push(userId);
      }
    }

    const [result] = await db.execute(query, params);
    return result.affectedRows > 0;
  }

  static async getStats(userRole = "user", userId = null) {
    let whereClause = "";
    const params = [];

    if (userRole !== "admin") {
      whereClause = "WHERE assigned_user_id = ?";
      params.push(userId);
    }

    const [totalResult] = await db.execute(
      `SELECT COUNT(*) as total FROM leads ${
        whereClause
          ? whereClause + " AND deleted_at IS NULL"
          : "WHERE deleted_at IS NULL"
      }`,
      params
    );
    const [wonResult] = await db.execute(
      `SELECT COUNT(*) as won FROM leads ${
        whereClause
          ? whereClause + " AND deleted_at IS NULL"
          : "WHERE deleted_at IS NULL"
      } AND stage = ?`,
      [...params, "won"]
    );
    const [activeResult] = await db.execute(
      `
      SELECT COUNT(*) as active FROM leads 
      ${
        whereClause
          ? whereClause + " AND deleted_at IS NULL"
          : "WHERE deleted_at IS NULL"
      } AND stage IN ('contacted', 'warm', 'negotiating')
    `,
      params
    );
    const [overdueResult] = await db.execute(
      `
      SELECT COUNT(*) as overdue FROM leads 
      ${
        whereClause
          ? whereClause + " AND deleted_at IS NULL"
          : "WHERE deleted_at IS NULL"
      } AND followup_date < CURDATE() AND stage NOT IN ('won', 'lost')
    `,
      params
    );

    const total = totalResult[0].total;
    const won = wonResult[0].won;
    const active = activeResult[0].active;
    const overdue = overdueResult[0].overdue;

    return {
      total,
      won,
      active,
      overdue,
      conversion_rate: total > 0 ? Math.round((won / total) * 100) : 0,
    };
  }

  static async getCountsByStage(filters = {}, userRole = "user", userId = null) {
    // Build WHERE clause
    let whereClause = "WHERE l.deleted_at IS NULL";
    const params = [];

    // Apply assigned_status filter (for Prospect user with custom tabs)
    if (filters.assigned_status) {
      if (filters.assigned_status === "unassigned") {
        whereClause += " AND l.assigned_user_id IS NULL";
      } else if (filters.assigned_status === "assigned") {
        whereClause += " AND l.assigned_user_id IS NOT NULL";
      }
      // User 7 (Prospect) can see ALL leads when using assigned_status filter
      // Other non-admin users with assigned_status filter should see leads created by them
      if (userRole !== "admin" && userId !== 7) {
        whereClause += " AND l.created_by = ?";
        params.push(userId);
      }
    } else {
      // Role-based filtering (regular flow)
      if (userRole !== "admin") {
        if (userId === 6 || userId === 7) {
          // For user 6 (Leadgen) and user 7 (Prospect), show leads assigned to them OR created by them
          whereClause += " AND (l.assigned_user_id = ? OR l.created_by = ?)";
          params.push(userId, userId);
        } else {
          // For other users, only show leads assigned to them
          whereClause += " AND l.assigned_user_id = ?";
          params.push(userId);
        }
      }
    }

    // Apply other filters
    if (filters.platform) {
      whereClause += " AND l.platform = ?";
      params.push(filters.platform);
    }

    if (filters.assigned_user_id) {
      whereClause += " AND l.assigned_user_id = ?";
      params.push(filters.assigned_user_id);
    }

    if (filters.search) {
      whereClause += " AND (l.contact_name LIKE ? OR l.company LIKE ?)";
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    // Handle follow-up filters
    if (filters.followup) {
      const today = new Date().toISOString().split("T")[0];

      switch (filters.followup) {
        case "overdue":
          whereClause += " AND l.followup_date < ?";
          params.push(today);
          break;
        case "today":
          whereClause += " AND l.followup_date = ?";
          params.push(today);
          break;
        case "week":
          const weekFromNow = new Date();
          weekFromNow.setDate(weekFromNow.getDate() + 7);
          whereClause += " AND l.followup_date BETWEEN ? AND ?";
          params.push(today, weekFromNow.toISOString().split("T")[0]);
          break;
        case "none":
          whereClause += " AND l.followup_date IS NULL";
          break;
      }
    }

    // Get counts per stage and total deal value per stage
    const query = `
      SELECT
        l.stage,
        COUNT(*) as count,
        SUM(l.deal_value) as total_value
      FROM leads l
      ${whereClause}
      GROUP BY l.stage
    `;

    const [rows] = await db.execute(query, params);

    // Convert to object with stage as key
    const counts = {};
    rows.forEach(row => {
      counts[row.stage] = {
        count: row.count,
        totalValue: row.total_value || 0
      };
    });

    return counts;
  }
}
