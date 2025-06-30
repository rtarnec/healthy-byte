// Import the Genkit core libraries and the Zod library for schema validation 
import { genkit, z } from "genkit";

// Import the Google AI plugin for Genkit
import { googleAI } from "@genkit-ai/googleai";

// Cloud Functions for Firebase supports Genkit natively.
// Import the Cloud Functions helper to expose Genkit flows as callable Cloud Functions
import { onCallGenkit, HttpsError } from "firebase-functions/https";

// Import Axios for making HTTP requests
import axios from "axios";

import { defineSecret } from "firebase-functions/params";

// Define environment secrets
const googleAIapiKey = defineSecret("GOOGLE_GENAI_API_KEY");
const apiNinjaKey = defineSecret("API_NINJA_KEY");

// Initialize Genkit with the Google AI plugin and specify the default model (Gemini 2.5 Flash)
const ai = genkit({
  plugins: [googleAI()],
  model: googleAI.model("gemini-2.5-flash"), // Set default model
});

// Define the expected structure for the nutrition data using Zod schema validation
const nutritionInformationSchema = z.array(
  z.object({
    name: z.string(),
    calories: z.string(),
    serving_size_g: z.string(),
    fat_total_g: z.number(),
    fat_saturated_g: z.number(),
    protein_g: z.string(),
    sodium_mg: z.number(),
    potassium_mg: z.number(),
    cholesterol_mg: z.number(),
    carbohydrates_total_g: z.number(),
    fiber_g: z.number(),
    sugar_g: z.number(),
  })
);

// Define a tool named 'nutritionFactsTool' that uses an external API to retrieve nutritional data
const nutritionFactsTool = ai.defineTool(
  {
    name: "nutritionFactsTool",
    description:
      "A tool that calls an API which extracts nutrition information from text using natural language processing. The API returns a JSON object with the different details like Total combined fat (including saturated and trans fats) in grams or Sodium in milligrams.",
    inputSchema: z.object({
      ingredientsList: z
        .string()
        .describe(
          "The quantity and name of all the ingredients for one person. Each ingredient and its quantity is separated by the **and** word."
        ),
    }),
    outputSchema: z.string(), // The tool returns a human-readable string summary of the nutritional info
  },
  async ({ ingredientsList }) => {
    try {
      const apiNinjaKey = process.env.API_NINJA_KEY;
      if (!apiNinjaKey) {
        throw new Error("API_NINJA_KEY environment variable is not set.");
      }

      // Call the API Ninjas nutrition endpoint with the ingredients list
      const response = await axios.get(
        "https://api.api-ninjas.com/v1/nutrition",
        {
          params: { query: ingredientsList },
          headers: {
            "Content-Type": "application/json",
            "X-Api-Key": apiNinjaKey,
          },
        }
      );

      // Validate and parse the response using the Zod schema defined above
      const parsed = nutritionInformationSchema.safeParse(response.data);
      if (!parsed.success) {
        console.error(
          "Nutrition data validation failed:",
          parsed.error.format()
        );
        throw new Error("Invalid nutrition data format received from API.");
      }

      const data = parsed.data;

      // Calculate the total sum of nutritional values across all ingredients
      const total = data.reduce(
        (acc, item) => {
          acc.fat += item.fat_total_g;
          acc.satFat += item.fat_saturated_g;
          acc.sodium += item.sodium_mg;
          acc.cholesterol += item.cholesterol_mg;
          acc.carbs += item.carbohydrates_total_g;
          acc.sugar += item.sugar_g;
          acc.potassium += item.potassium_mg;
          return acc;
        },
        {
          fat: 0,
          satFat: 0,
          sodium: 0,
          cholesterol: 0,
          carbs: 0,
          sugar: 0,
          potassium: 0,
        }
      );

      // Return a formatted string summarizing the total nutritional data
      return `Total fat: ${total.fat.toFixed(1)}g, saturated fat: ${total.satFat.toFixed(1)}g, sodium: ${total.sodium}mg, cholesterol: ${total.cholesterol}mg, carbs: ${total.carbs.toFixed(1)}g, sugars: ${total.sugar.toFixed(1)}g, potassium: ${total.potassium}mg.`;
    } catch (err) {
      console.error("Error in nutritionFactsTool:", err);
      throw new Error("Unable to retrieve or process nutrition information.");
    }
  }
);

// Define the Genkit flow and exepose it as a Firebase Callable Function
export const recipesSuggestion = onCallGenkit(
  {
    secrets: [googleAIapiKey, apiNinjaKey],
  },
  ai.defineFlow(
    {
      name: "recipesSuggestionFlow",

      inputSchema: z.object({
        ingredients: z.array(z.string()), // Input: list of ingredients, entered in the front end
      }),

      outputSchema: z.object({
        recipes: z.array(
          z.object({
            title: z.string(),
            ingredients: z.string(),
            instructions: z.string(),
            nutritionInformation: z.string(),
          })
        ),
        healthiestRecommendation: z.string(),
      }),
    },
    async (query) => {
      try {
        // In Genkit, the primary interface through which you interact with generative AI models is the generate() method.
        const llmResponse = await ai.generate({
          config: {
            temperature: 0, // Low temperature for more deterministic and fact-based output
          },
          tools: [nutritionFactsTool], // Include the custom nutrition tool
          prompt: `You are a professional chef and AI assistant. Your task is to generate exactly three recipes based on the provided ingredients: ${query.ingredients}.

                Return your full response as a valid JSON **object** with two properties:
                1. "recipes": an array of exactly 3 recipe objects.
                2. "healthiestRecommendation": a string identifying which of the three recipes is the healthiest, with an explanation.

                Each recipe object must include the following 4 string properties:
                - "title": A concise recipe name.
                - "ingredients": A comma-separated list of max 8 ingredients with the quantities for 4 people.
                - "instructions": A single string of a maximum 80 words describing how to cook the recipe.
                - "nutritionInformation": A string summarizing the key nutrition data for one person (e.g. total fat in grams, sugar, cholesterol, sodium, etc.).

                Use the provided tool "nutritionFactsTool" to fetch nutritional data for each recipe.
                To call the tool, provide an object with key "ingredientsList" containing all the ingredients and quantities for ony one person, separated by "and".
                Example: { "ingredientsList": "150g beef and 200g pumpkin and 50ml heavy cream" }

                For 'healthiestRecommendation', compare the recipes based on key metrics like total fat, saturated fat, sodium, sugar, and cholesterol, 
                and also consider the overall nutritional quality of the ingredients.
                Clearly explain why one recipe is healthier than the others.`,
        });

        // Return the generated recipes and healthiest recommendation
        return llmResponse.output;

      } catch (error) {
        throw new HttpsError("internal", JSON.stringify(error));
      }
    }
  )
);
