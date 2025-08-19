import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Category mapping to user IDs
const CATEGORY_USER_MAPPING = {
  development: 4,
  design: 3,
  "mobile app design and development": 5,
};

export async function categorizeLead(notes) {
  if (!notes || notes.trim() === "") {
    return null;
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are tasked with categorizing lead notes into one of three categories based on the service they're looking for:

1. "development" - for web development, backend development, API development, database work, server-side work, full-stack development
2. "design" - for UI/UX design, graphic design, branding, visual design, website design (not development)
3. "mobile app design and development" - for mobile app projects, iOS/Android development, React Native, Flutter, mobile UI/UX

Respond with only one word: "development", "design", or "mobile app design and development". If the notes don't clearly fit any category, respond with "development" as default.`,
        },
        {
          role: "user",
          content: `Please categorize this lead based on their notes: "${notes}"`,
        },
      ],
      max_tokens: 20,
      temperature: 0,
    });

    const category = response.choices[0].message.content.trim().toLowerCase();
    
    // Get the assigned user ID for this category
    const assignedUserId = CATEGORY_USER_MAPPING[category] || CATEGORY_USER_MAPPING.development;
    
    return {
      category,
      assignedUserId,
    };
  } catch (error) {
    console.error("Error categorizing lead with OpenAI:", error);
    // Default to development category if AI fails
    return {
      category: "development",
      assignedUserId: CATEGORY_USER_MAPPING.development,
    };
  }
}