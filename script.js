import mysql from "mysql2/promise";
import dotenv from "dotenv";
import OpenAI from "openai";
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
};

const db = mysql.createPool(dbConfig);

async function modifyDatabase() {
  try {
    const [rows] = await db.query(
      "SELECT * FROM leads WHERE assigned_user_id != 6 AND deleted_at IS NULL"
    );
    console.log(`Processing ${rows.length} leads...`);

    for (let i = 0; i < rows.length; i++) {
      const { id, company, notes } = rows[i];
      console.log(`Processing lead ${id}...`);

      const companyIsEmpty = isCompanyEmpty(company);

      if (companyIsEmpty) {
        console.log(`Company field is empty for lead ${id}, checking notes...`);
        const hasCompanyInNotes = await checkForCompanyInNotes(notes);

        if (!hasCompanyInNotes) {
          console.log(
            `No company found in notes for lead ${id}, soft deleting...`
          );
          await softDeleteLead(id);
        } else {
          console.log(`Company found in notes for lead ${id}, keeping record.`);
        }
      } else {
        console.log(`Company field has value for lead ${id}: ${company}`);
      }
    }

    console.log("Processing complete.");
  } catch (error) {
    console.error("Error in modifyDatabase:", error);
  } finally {
    await db.end();
  }
}

modifyDatabase();

function isCompanyEmpty(company) {
  if (!company || company === null || company === undefined) return true;
  const trimmed = String(company).trim().toLowerCase();
  return (
    trimmed === "" ||
    trimmed === "na" ||
    trimmed === "n/a" ||
    trimmed === "null"
  );
}

async function checkForCompanyInNotes(notes) {
  if (!notes || notes.trim() === "") return false;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are tasked with analyzing text to determine if it contains any company names, business names, or organization names. Respond with only 'YES' if you find any company/business/organization names, or 'NO' if you don't find any.",
        },
        {
          role: "user",
          content: `Please analyze this text and determine if it contains any company names, business names, or organization names: "${notes}"`,
        },
      ],
      max_tokens: 10,
      temperature: 0,
    });

    const result = response.choices[0].message.content.trim().toLowerCase();
    return result === "yes";
  } catch (error) {
    console.error("Error analyzing notes with OpenAI:", error);
    return false;
  }
}

async function softDeleteLead(leadId) {
  try {
    await db.query("UPDATE leads SET deleted_at = NOW() WHERE id = ?", [
      leadId,
    ]);
    console.log(`Soft deleted lead with ID: ${leadId}`);
  } catch (error) {
    console.error(`Error soft deleting lead ${leadId}:`, error);
  }
}
