import db from "../config/database.js";
export default class Activity {
  static async getByLeadId(leadId) {
    const [rows] = await db.execute(
      `
      SELECT
        a.id,
        a.lead_id,
        a.type,
        a.description,
        a.activity_date as date,
        a.user_id,
        a.created_at,
        u.name as user
      FROM activities a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.lead_id = ?
      ORDER BY a.activity_date DESC
    `,
      [leadId]
    );

    return rows;
  }

  static async create(activityData) {
    const { lead_id, type, description, activity_date, user_id } = activityData;

    // Convert ISO 8601 datetime to MySQL format (YYYY-MM-DD HH:MM:SS)
    const formattedDate = new Date(activity_date)
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ');

    const [result] = await db.execute(
      `
      INSERT INTO activities (lead_id, type, description, activity_date, user_id)
      VALUES (?, ?, ?, ?, ?)
    `,
      [lead_id, type, description, formattedDate, user_id]
    );

    // Update lead's updated_at timestamp
    await db.execute(
      `
      UPDATE leads SET updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `,
      [lead_id]
    );

    return result.insertId;
  }

  static async delete(id) {
    const [result] = await db.execute("DELETE FROM activities WHERE id = ?", [
      id,
    ]);
    return result.affectedRows > 0;
  }
}
