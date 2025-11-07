import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const translateText = async (text: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Translate the following text to Burmese. Provide only the translation, without any introductory phrases or explanations: "${text}"`,
    });
    return response.text.trim();
  } catch (error) {
    console.error("Gemini API Error: Failed to translate text.", error);
    throw new Error("Translation failed.");
  }
};
