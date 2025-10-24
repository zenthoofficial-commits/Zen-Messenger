import { GoogleGenAI } from "@google/genai";

// As per guidelines, the API key is sourced from process.env.API_KEY
// and we should not handle its configuration in the UI.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

export async function translateText(text: string, targetLanguage: string = "Burmese"): Promise<string> {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Translate the following text to ${targetLanguage} and provide only the translation: "${text}"`,
        });

        const translation = response.text;
        if (!translation) {
            throw new Error("No translation found in response.");
        }
        return translation.trim();
    } catch (error) {
        console.error("Gemini translation error:", error);
        return "Translation failed.";
    }
}