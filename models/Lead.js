import db from "../config/database.js";
export default class Lead {
  static async getAll(filters = {}, userRole = "user", userId = null) {
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
        creator.name as created_by_name
      FROM leads l
      LEFT JOIN users u ON l.assigned_user_id = u.id
      LEFT JOIN users creator ON l.created_by = creator.id
      WHERE 1=1
    `;

    const params = [];

    // Role-based filtering
    if (userRole !== "admin") {
      query += " AND l.assigned_user_id = ?";
      params.push(userId);
    }

    // Apply other filters
    if (filters.platform) {
      query += " AND l.platform = ?";
      params.push(filters.platform);
    }

    if (filters.assigned_user_id) {
      query += " AND l.assigned_user_id = ?";
      params.push(filters.assigned_user_id);
    }

    if (filters.stage) {
      query += " AND l.stage = ?";
      params.push(filters.stage);
    }

    if (filters.search) {
      query += " AND (l.contact_name LIKE ? OR l.company LIKE ?)";
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    // Handle follow-up filters
    if (filters.followup) {
      const today = new Date().toISOString().split("T")[0];

      switch (filters.followup) {
        case "overdue":
          query += " AND l.followup_date < ?";
          params.push(today);
          break;
        case "today":
          query += " AND l.followup_date = ?";
          params.push(today);
          break;
        case "week":
          const weekFromNow = new Date();
          weekFromNow.setDate(weekFromNow.getDate() + 7);
          query += " AND l.followup_date BETWEEN ? AND ?";
          params.push(today, weekFromNow.toISOString().split("T")[0]);
          break;
        case "none":
          query += " AND l.followup_date IS NULL";
          break;
      }
    }

    query += " ORDER BY l.updated_at DESC";

    const [rows] = await db.execute(query, params);
    return rows;
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
      WHERE l.id = ?
    `;

    const params = [id];

    // Role-based filtering
    if (userRole !== "admin") {
      query += " AND l.assigned_user_id = ?";
      params.push(userId);
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
        assigned_user_id || null,
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
      WHERE id = ?
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
    if (userRole !== "admin") {
      query += " AND assigned_user_id = ?";
      params.push(userId);
    }

    const [result] = await db.execute(query, params);

    if (result.affectedRows === 0) {
      throw new Error("Lead not found or access denied");
    }

    return this.getById(id, userRole, userId);
  }

  static async delete(id, userRole = "user", userId = null) {
    let query = "DELETE FROM leads WHERE id = ?";
    const params = [id];

    // Role-based filtering
    if (userRole !== "admin") {
      query += " AND assigned_user_id = ?";
      params.push(userId);
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
      `SELECT COUNT(*) as total FROM leads ${whereClause}`,
      params
    );
    const [wonResult] = await db.execute(
      `SELECT COUNT(*) as won FROM leads ${whereClause} ${
        whereClause ? "AND" : "WHERE"
      } stage = "won"`,
      [...params, ...(whereClause ? ["won"] : [])]
    );
    const [activeResult] = await db.execute(
      `
      SELECT COUNT(*) as active FROM leads 
      ${whereClause} ${
        whereClause ? "AND" : "WHERE"
      } stage IN ('contacted', 'warm', 'negotiating')
    `,
      params
    );
    const [overdueResult] = await db.execute(
      `
      SELECT COUNT(*) as overdue FROM leads 
      ${whereClause} ${
        whereClause ? "AND" : "WHERE"
      } followup_date < CURDATE() AND stage NOT IN ('won', 'lost')
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
}
