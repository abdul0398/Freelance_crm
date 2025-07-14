import db from "../config/database.js";
export default class Activity {
  static async getByLeadId(leadId) {
    const [rows] = await db.execute(
      `
      SELECT 
        a.*,
        u.name as user_name
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

    const [result] = await db.execute(
      `
      INSERT INTO activities (lead_id, type, description, activity_date, user_id)
      VALUES (?, ?, ?, ?, ?)
    `,
      [lead_id, type, description, activity_date, user_id]
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
