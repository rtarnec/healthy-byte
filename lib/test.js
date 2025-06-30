"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.recipesSuggestion = void 0;
// Import the Genkit core libraries and plugins.
// z = Zod, a TypeScript-first library for validating schemas
const genkit_1 = require("genkit");
// Import the googleAI plugin
const googleai_1 = require("@genkit-ai/googleai");
// Cloud Functions for Firebase supports Genkit natively. 
// The onCallGenkit function creates a callable function from a Genkit action.
const https_1 = require("firebase-functions/https");
const axios_1 = __importDefault(require("axios"));
const params_1 = require("firebase-functions/params");
const googleAIapiKey = (0, params_1.defineSecret)("GOOGLE_GENAI_API_KEY");
const apiNinjaKey = (0, params_1.defineSecret)("API_NINJA_KEY");
const ai = (0, genkit_1.genkit)({
    plugins: [(0, googleai_1.googleAI)()],
    model: googleai_1.googleAI.model('gemini-2.5-flash'), // Set default model
});
const nutritionInformationSchema = genkit_1.z.array(genkit_1.z.object({
    name: genkit_1.z.string(),
    calories: genkit_1.z.string(),
    serving_size_g: genkit_1.z.string(),
    fat_total_g: genkit_1.z.number(),
    fat_saturated_g: genkit_1.z.number(),
    protein_g: genkit_1.z.string(),
    sodium_mg: genkit_1.z.number(),
    potassium_mg: genkit_1.z.number(),
    cholesterol_mg: genkit_1.z.number(),
    carbohydrates_total_g: genkit_1.z.number(),
    fiber_g: genkit_1.z.number(),
    sugar_g: genkit_1.z.number(),
}));
const nutritionFactsTool = ai.defineTool({
    name: "nutritionFactsTool",
    description: "A tool that calls an API which extracts nutrition information from text using natural language processing. The API returns a JSON object with the different details like Total combined fat (including saturated and trans fats) in grams or Sodium in milligrams.",
    inputSchema: genkit_1.z.object({
        ingredientsList: genkit_1.z
            .string()
            .describe("The quantity and name of all the ingredients for one person. Each ingredient and its quantity is seprated buy the **and** word."),
    }),
    outputSchema: genkit_1.z.string(), // On retourne une string formatée ici
}, async ({ ingredientsList }) => {
    try {
        const apiNinjaKey = process.env.API_NINJA_KEY;
        if (!apiNinjaKey) {
            throw new Error("API_NINJA_KEY environment variable is not set.");
        }
        const response = await axios_1.default.get("https://api.api-ninjas.com/v1/nutrition", {
            params: { query: ingredientsList },
            headers: {
                "Content-Type": "application/json",
                "X-Api-Key": apiNinjaKey,
            },
        });
        const parsed = nutritionInformationSchema.safeParse(response.data);
        if (!parsed.success) {
            console.error("Nutrition data validation failed:", parsed.error.format());
            throw new Error("Invalid nutrition data format received from API.");
        }
        const data = parsed.data;
        // We calculate the total of the nutritional values
        const total = data.reduce((acc, item) => {
            acc.fat += item.fat_total_g;
            acc.satFat += item.fat_saturated_g;
            acc.sodium += item.sodium_mg;
            acc.cholesterol += item.cholesterol_mg;
            acc.carbs += item.carbohydrates_total_g;
            acc.sugar += item.sugar_g;
            acc.potassium += item.potassium_mg;
            return acc;
        }, {
            fat: 0,
            satFat: 0,
            sodium: 0,
            cholesterol: 0,
            carbs: 0,
            sugar: 0,
            potassium: 0,
        });
        return Total;
        fat: $;
        {
            total.fat.toFixed(1);
        }
        g, saturated;
        fat: $;
        {
            total.satFat.toFixed(1);
        }
        g, sodium;
        $;
        {
            total.sodium;
        }
        mg, cholesterol;
        $;
        {
            total.cholesterol;
        }
        mg, carbs;
        $;
        {
            total.carbs.toFixed(1);
        }
        g, sugars;
        $;
        {
            total.sugar.toFixed(1);
        }
        g, potassium;
        $;
        {
            total.potassium;
        }
        mg.;
    }
    catch (err) {
        console.error("Error in nutritionFactsTool:", err);
        throw new Error("Unable to retrieve or process nutrition information.");
    }
});
exports.recipesSuggestion = (0, https_1.onCallGenkit)({
    secrets: [googleAIapiKey, apiNinjaKey],
}, ai.defineFlow({
    name: "recipesSuggestionFlow",
    inputSchema: genkit_1.z.object({
        ingredients: genkit_1.z.array(genkit_1.z.string()),
    }),
    outputSchema: genkit_1.z.object({
        recipes: genkit_1.z.array(genkit_1.z.object({
            title: genkit_1.z.string(),
            ingredients: genkit_1.z.string(),
            instructions: genkit_1.z.string(),
            nutritionInformation: genkit_1.z.string(),
        })),
        healthiestRecommendation: genkit_1.z.string(),
    }),
}, async (query) => {
    const llmResponse = await ai.generate({
        config: {
            temperature: 0.1,
        },
        tools: [nutritionFactsTool],
        prompt: `You are a professional chef and AI assistant. Your task is to generate exactly three recipes based on the provided ingredients: ${query.ingredients}.

                Return your full response as a valid JSON **object** with two properties:
                1. "recipes": an array of exactly 3 recipe objects.
                2. "healthiestRecommendation": a string identifying which of the three recipes is the healthiest, with an explanation.

                Each recipe object must include the following 4 string properties:
                - "title": A concise recipe name.
                - "ingredients": A comma-separated list of max 8 ingredients with the quantities for 4 people.
                - "instructions": A single string of maximum 80 words describing how to cook the recipe.
                - "nutritionInformation": A string summarizing the key nutrition data for one person (e.g. total fat in grams, sugar, cholesterol, sodium, etc.).

                Use the provided tool "nutritionFactsTool" to fetch nutritional data for each recipe.
                To call the tool, provide an object with key "ingredientsList" containing all the ingredients and quantities for ony one person, separated by "and".
                Example: { "ingredientsList": "150g beef and 200g pumpkin and 50ml heavy cream" }

                For 'healthiestRecommendation', compare the recipes based on key metrics like total fat, saturated fat, sodium, sugar, and cholesterol, 
                and also consider the overall nutritional quality of the ingredients.
                Clearly explain why one recipe is healthier than the others.`,
    });
    return llmResponse.output;
}));
//# sourceMappingURL=test.js.map