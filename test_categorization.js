import { categorizeLead } from "./services/leadCategorizer.js";

// Test cases
const testCases = [
  {
    notes: "Looking for a web developer to build an e-commerce website with React and Node.js",
    expected: "development"
  },
  {
    notes: "Need UI/UX design for my startup's landing page and branding",
    expected: "design"
  },
  {
    notes: "Want to create a mobile app for iOS and Android with user authentication",
    expected: "mobile app design and development"
  }
];

async function testCategorization() {
  console.log("Testing lead categorization...\n");
  
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`Test ${i + 1}:`);
    console.log(`Notes: ${testCase.notes}`);
    console.log(`Expected: ${testCase.expected}`);
    
    try {
      const result = await categorizeLead(testCase.notes);
      console.log(`Result: ${result.category}`);
      console.log(`Assigned User ID: ${result.assignedUserId}`);
      console.log(`✓ ${result.category === testCase.expected ? 'PASS' : 'FAIL'}\n`);
    } catch (error) {
      console.log(`✗ ERROR: ${error.message}\n`);
    }
  }
}

testCategorization();