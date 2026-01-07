import mysql from "mysql2/promise";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
};

const db = mysql.createPool(dbConfig);

async function categorizeBatchOfLeads(leadsBatch) {
  if (!leadsBatch || leadsBatch.length === 0) {
    return [];
  }

  try {
    // Prepare the leads data for the prompt
    const leadsData = leadsBatch.map((lead, index) => ({
      index: index,
      leadId: lead.id,
      description: lead.notes || "No description provided",
    }));

    const leadsText = leadsData
      .map(
        (lead) =>
          `Lead ${lead.index}: (ID: ${lead.leadId})\nDescription: ${lead.description}`
      )
      .join("\n\n");

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are tasked with categorizing multiple client leads into departments based on their descriptions.

Available departments (choose only from these three):
1. "web" - web development, backend, frontend, API, database, server-side, full-stack development, website development
2. "design" - UI/UX design, graphic design, branding, visual design, logo design, brand identity
3. "mobile" - mobile app development, iOS/Android apps, React Native, Flutter, mobile applications

Respond in JSON format with a "leads" array. Each item should have:
- "index": the lead index number
- "leadId": the lead ID
- "department": one of the above three department names EXACTLY as written ("web", "design", or "mobile")

Example response:
{
  "leads": [
    {"index": 0, "leadId": 123, "department": "web"},
    {"index": 1, "leadId": 124, "department": "design"}
  ]
}`,
        },
        {
          role: "user",
          content: `Please categorize these leads:\n\n${leadsText}`,
        },
      ],
      max_tokens: 300,
      temperature: 0,
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content.trim());
    return result.leads || [];
  } catch (error) {
    console.error("Error categorizing batch with OpenAI:", error.message);
    // Return error categorization for all leads in the batch
    return leadsBatch.map((lead, index) => ({
      index: index,
      leadId: lead.id,
      department: "error",
    }));
  }
}

async function categorizeUser8Leads2026() {
  try {
    // Fetch all leads before 2026 assigned to user ID 8
    const query = `
      SELECT
        id,
        contact_name,
        company,
        notes,
        platform,
        stage,
        created_at
      FROM leads
      WHERE assigned_user_id = 8
        AND YEAR(created_at) < 2026
        AND deleted_at IS NULL
      ORDER BY created_at DESC
    `;

    console.log("Fetching leads before 2026 assigned to user ID 8...\n");
    const [leads] = await db.query(query);

    if (leads.length === 0) {
      console.log("No leads found for user ID 8 before 2026.");
      return;
    }

    console.log(`Found ${leads.length} leads. Starting categorization...\n`);
    console.log("=".repeat(80));

    const results = [];
    const BATCH_SIZE = 10;

    // Process leads in batches of 10
    for (let i = 0; i < leads.length; i += BATCH_SIZE) {
      const batch = leads.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(leads.length / BATCH_SIZE);

      console.log(
        `\n📦 Processing Batch ${batchNumber}/${totalBatches} (${batch.length} leads)...`
      );

      // Get categorizations for the entire batch
      const categorizations = await categorizeBatchOfLeads(batch);

      // Process each lead in the batch
      for (let j = 0; j < batch.length; j++) {
        const lead = batch[j];
        const categorization = categorizations[j] || {
          department: "error",
        };

        console.log(`\n[${i + j + 1}/${leads.length}] Lead ID: ${lead.id}`);
        console.log(`Contact: ${lead.contact_name || "N/A"}`);
        console.log(`Company: ${lead.company || "N/A"}`);
        console.log(`Platform: ${lead.platform || "N/A"}`);
        console.log(`Stage: ${lead.stage || "N/A"}`);
        console.log(`Created: ${lead.created_at}`);
        console.log(
          `Description: ${
            lead.notes
              ? lead.notes.substring(0, 100) +
                (lead.notes.length > 100 ? "..." : "")
              : "No description"
          }`
        );

        console.log(`→ Department: ${categorization.department}`);

        // Update database if department is valid
        const validDepartments = ["web", "design", "mobile"];
        if (validDepartments.includes(categorization.department)) {
          try {
            await db.query("UPDATE leads SET department = ? WHERE id = ?", [
              categorization.department,
              lead.id,
            ]);
            console.log(`✅ Updated in database`);
          } catch (error) {
            console.log(`❌ Failed to update: ${error.message}`);
          }
        } else {
          console.log(`⚠️  Skipped update (invalid department)`);
        }

        console.log("-".repeat(80));

        results.push({
          leadId: lead.id,
          contactName: lead.contact_name,
          company: lead.company,
          department: categorization.department,
          description: lead.notes,
        });
      }

      // Small delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < leads.length) {
        console.log("\n⏳ Waiting 1 second before next batch...");
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Summary
    console.log("\n" + "=".repeat(80));
    console.log("CATEGORIZATION SUMMARY");
    console.log("=".repeat(80));

    const departmentCounts = {};
    const updatedCount = results.filter((r) =>
      ["web", "design", "mobile"].includes(r.department)
    ).length;
    const skippedCount = results.length - updatedCount;

    results.forEach((result) => {
      departmentCounts[result.department] =
        (departmentCounts[result.department] || 0) + 1;
    });

    console.log("\nDepartment Distribution:");
    Object.entries(departmentCounts).forEach(([dept, count]) => {
      const percentage = ((count / results.length) * 100).toFixed(1);
      console.log(`  ${dept}: ${count} leads (${percentage}%)`);
    });

    console.log("\n" + "=".repeat(80));
    console.log(`✅ Successfully updated: ${updatedCount} leads`);
    console.log(`⚠️  Skipped: ${skippedCount} leads`);
    console.log("Processing complete!");
  } catch (error) {
    console.error("Error in categorizeUser8Leads2026:", error);
  } finally {
    await db.end();
  }
}

// Run the script
categorizeUser8Leads2026();
