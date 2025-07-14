import db from "../config/database.js";
import bcrypt from "bcryptjs";

export default class User {
  static async getAll(role, userId) {
    console.log(role, userId);
    let query = `
      SELECT id, name, email, role, is_active, created_at, updated_at 
      FROM users 
      WHERE is_active = TRUE 
    `;

    // If the user is not an admin, filter by user ID
    if (role !== "admin") {
      query += ` AND id = ?`;
    }

    query += ` ORDER BY name`;

    const [rows] = await db.execute(query, role !== "admin" ? [userId] : []);
    return rows;
  }

  static async getById(id) {
    const [rows] = await db.execute(
      `
      SELECT id, name, email, role, is_active, created_at, updated_at 
      FROM users 
      WHERE id = ? AND is_active = TRUE
    `,
      [id]
    );
    return rows[0];
  }

  static async getByEmail(email) {
    const [rows] = await db.execute(
      `
      SELECT * FROM users WHERE email = ? AND is_active = TRUE
    `,
      [email]
    );
    return rows[0];
  }

  static async createAdmin(name, email, password) {
    try {
      // Check if user already exists
      const existingUser = await this.getByEmail(email);
      if (existingUser) {
        console.log("Admin user already exists");
        return;
      }

      // Validate password
      if (password.length < 6) {
        throw new Error("Password must be at least 6 characters long");
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Insert admin user
      const [result] = await db.execute(
        `
        INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)
      `,
        [name, email, hashedPassword, "admin"]
      );

      console.log(
        `✅ Admin user created - ID: ${result.insertId}, Email: ${email}`
      );
      return result.insertId;
    } catch (error) {
      console.error("❌ Error creating admin user:", error.message);
      throw error;
    }
  }

  static async create(userData) {
    const { name, email, password, role = "user" } = userData;

    // Check if email already exists
    const existingUser = await this.getByEmail(email);
    if (existingUser) {
      throw new Error("Email already exists");
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await db.execute(
      `
      INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)
    `,
      [name, email, hashedPassword, role]
    );

    return result.insertId;
  }

  static async update(id, userData) {
    const { name, email, role } = userData;

    await db.execute(
      `
      UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?
    `,
      [name, email, role, id]
    );

    return this.getById(id);
  }

  static async updatePassword(id, newPassword) {
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db.execute(
      `
      UPDATE users SET password = ? WHERE id = ?
    `,
      [hashedPassword, id]
    );
  }

  static async delete(id) {
    // Soft delete - set is_active to FALSE
    const [result] = await db.execute(
      `
      UPDATE users SET is_active = FALSE WHERE id = ?
    `,
      [id]
    );
    return result.affectedRows > 0;
  }

  static async authenticate(email, password) {
    const user = await this.getByEmail(email);
    if (!user) {
      return null;
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return null;
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  }
}
