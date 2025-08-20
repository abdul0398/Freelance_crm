import mysql from "mysql2/promise";
import dotenv from "dotenv";
import OpenAI from "openai";
import { categorizeLead } from "./services/leadCategorizer.js";
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
          content: `You are a text analyzer. Your job is to check if the text explicitly mentions a company name in the format like "Client's company:" or similar.
          
    Rules:
    - If the text contains "Client's company:" followed by an actual name → reply ONLY "YES".
    - If it says "Client's company: Not provided", "N/A", or is blank → reply ONLY "NO".
    - If no "Client's company:" field exists → reply ONLY "NO".
    - Do not add explanations or any extra text.`,
        },
        {
          role: "user",
          content: `Analyze this text: "${notes}"`,
        },
      ],
      max_tokens: 2,
      temperature: 0,
    });

    const result = response.choices[0].message.content.trim().toLowerCase();
    return result === "yes";
  } catch (error) {
    console.error("Error analyzing notes with OpenAI:", error);
    console.log("AI API failed - skipping deletion to be safe");
    return true; // Return true to prevent deletion when AI API fails
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

async function start() {
  await modifyDatabase();
  await modifyLeadAssign();
}

async function modifyLeadAssign() {
  try {
    const query =
      "SELECT * FROM leads WHERE assigned_user_id = 6 AND deleted_at IS NULL";
    console.log("Starting lead reassignment process...");
    console.log("Query:", query);

    const [rows] = await db.query(query);
    console.log(
      `Found ${rows.length} leads with user ID 6 that are soft-deleted`
    );

    for (let i = 0; i < rows.length; i++) {
      const element = rows[i];
      console.log(
        `\nProcessing lead ${i + 1}/${rows.length} - ID: ${element.id}`
      );
      console.log(`Current assigned_user_id: ${element.assigned_user_id}`);
      console.log(
        `Notes preview: ${
          element.notes ? element.notes.substring(0, 100) + "..." : "No notes"
        }`
      );

      try {
        const categorization = await categorizeLead(element.notes);
        console.log(`Categorization result:`, categorization);

        if (categorization && categorization.assignedUserId) {
          console.log(
            `Reassigning lead ${element.id} from user 6 to user ${categorization.assignedUserId}`
          );
          const updateQuery =
            "UPDATE leads SET assigned_user_id = ? WHERE id = ?";
          await db.query(updateQuery, [
            categorization.assignedUserId,
            element.id,
          ]);
          console.log(`✅ Successfully reassigned lead ${element.id}`);
        } else {
          console.log(
            `❌ No valid user assignment found for lead ${element.id}, keeping current assignment`
          );
        }
      } catch (error) {
        console.error(`Error processing lead ${element.id}:`, error);
        console.log(`Skipping lead ${element.id} due to error`);
      }
    }

    console.log(
      `\nLead reassignment process complete. Processed ${rows.length} leads.`
    );
  } catch (error) {
    console.error("Error in modifyLeadAssign:", error);
  }
}
start();
