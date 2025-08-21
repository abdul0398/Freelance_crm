import OpenAI from "openai";
import dotenv from "dotenv";
import db from "../config/database.js";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function checkForDuplicates(newLead) {
  try {
    // Smart pre-filtering: Get potential matches using basic SQL matching first
    const [existingLeads] = await db.execute(`
      SELECT id, contact_name, company, platform, deal_value, notes, created_at
      FROM leads 
      WHERE deleted_at IS NULL
      AND (
        LOWER(contact_name) LIKE LOWER(CONCAT('%', ?, '%')) OR
        LOWER(company) LIKE LOWER(CONCAT('%', ?, '%')) OR
        platform = ? OR
        (notes IS NOT NULL AND LOWER(notes) LIKE LOWER(CONCAT('%', ?, '%')))
      )
      ORDER BY created_at DESC
      LIMIT 50
    `, [
      newLead.contact_name || '',
      newLead.company || '',
      newLead.platform || '',
      newLead.contact_name || ''
    ]);

    if (existingLeads.length === 0) {
      return {
        hasDuplicates: false,
        duplicates: [],
        highestScore: 0
      };
    }

    // Prepare the new lead data for AI analysis
    const newLeadContext = `
Contact Name: ${newLead.contact_name || 'N/A'}
Company: ${newLead.company || 'N/A'}
Platform: ${newLead.platform || 'N/A'}
Deal Value: $${newLead.deal_value || 0}
Notes: ${newLead.notes || 'N/A'}
    `.trim();

    // Prepare existing leads data for comparison
    const existingLeadsContext = existingLeads.map((lead, index) => `
Lead ${index + 1} (ID: ${lead.id}):
Contact Name: ${lead.contact_name || 'N/A'}
Company: ${lead.company || 'N/A'}
Platform: ${lead.platform || 'N/A'}
Deal Value: $${lead.deal_value || 0}
Notes: ${lead.notes || 'N/A'}
Created: ${lead.created_at}
    `).join('\n');

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are a duplicate detection system for a CRM. Your task is to analyze a new lead and compare it with existing leads to find potential duplicates.

Consider these factors when determining duplicates:
1. Same or very similar contact names (accounting for nicknames, abbreviations)
2. Same company or organization
3. Similar project descriptions or requirements in notes
4. Similar deal values for the same type of work
5. Context clues that suggest the same person/project (email domains, specific requirements, etc.)

For each potential duplicate found, provide a similarity score from 0-100 where:
- 90-100: Almost certain duplicate (same person/company/project)
- 70-89: Very likely duplicate (strong similarities)
- 50-69: Possible duplicate (some similarities worth reviewing)
- Below 50: Not a duplicate

Respond with a JSON object in this exact format:
{
  "duplicates": [
    {
      "leadId": 123,
      "similarityScore": 85,
      "reason": "Same contact name and company, similar project requirements"
    }
  ]
}

If no duplicates found, return: {"duplicates": []}

Only include leads with similarity scores of 50 or higher. Limit to top 5 matches.`
        },
        {
          role: "user",
          content: `NEW LEAD TO CHECK:
${newLeadContext}

EXISTING LEADS TO COMPARE AGAINST:
${existingLeadsContext}

Analyze the new lead against all existing leads and identify potential duplicates.`
        }
      ],
      max_tokens: 1000,
      temperature: 0.1,
    });

    let aiResponse;
    try {
      aiResponse = JSON.parse(response.choices[0].message.content.trim());
    } catch (parseError) {
      console.error("Error parsing AI response:", parseError);
      return {
        hasDuplicates: false,
        duplicates: [],
        highestScore: 0,
        error: "Failed to parse AI response"
      };
    }

    // Enrich the AI response with lead details
    const enrichedDuplicates = aiResponse.duplicates.map(duplicate => {
      const leadDetails = existingLeads.find(lead => lead.id === duplicate.leadId);
      return {
        ...duplicate,
        contactName: leadDetails?.contact_name,
        company: leadDetails?.company,
        platform: leadDetails?.platform,
        dealValue: leadDetails?.deal_value,
        createdAt: leadDetails?.created_at,
        notes: leadDetails?.notes
      };
    }).filter(duplicate => duplicate.contactName); // Filter out any invalid matches

    // Sort by similarity score (highest first)
    enrichedDuplicates.sort((a, b) => b.similarityScore - a.similarityScore);

    return {
      hasDuplicates: enrichedDuplicates.length > 0,
      duplicates: enrichedDuplicates.slice(0, 5), // Top 5 matches
      highestScore: enrichedDuplicates.length > 0 ? enrichedDuplicates[0].similarityScore : 0
    };

  } catch (error) {
    console.error("Error checking for duplicates with AI:", error);
    
    // Fallback: Basic string similarity check
    return await basicDuplicateCheck(newLead);
  }
}

// Fallback function for basic duplicate checking if AI fails
async function basicDuplicateCheck(newLead) {
  try {
    const [existingLeads] = await db.execute(`
      SELECT id, contact_name, company, platform, deal_value, created_at
      FROM leads 
      WHERE deleted_at IS NULL
      AND (
        LOWER(contact_name) = LOWER(?) 
        OR (company IS NOT NULL AND LOWER(company) = LOWER(?))
      )
      LIMIT 5
    `, [newLead.contact_name, newLead.company || '']);

    const duplicates = existingLeads.map(lead => ({
      leadId: lead.id,
      contactName: lead.contact_name,
      company: lead.company,
      platform: lead.platform,
      dealValue: lead.deal_value,
      createdAt: lead.created_at,
      similarityScore: 75, // Basic match gets 75% similarity
      reason: "Exact name or company match (fallback detection)"
    }));

    return {
      hasDuplicates: duplicates.length > 0,
      duplicates,
      highestScore: duplicates.length > 0 ? 75 : 0,
      fallbackUsed: true
    };

  } catch (error) {
    console.error("Error in basic duplicate check:", error);
    return {
      hasDuplicates: false,
      duplicates: [],
      highestScore: 0,
      error: "Duplicate detection failed"
    };
  }
}