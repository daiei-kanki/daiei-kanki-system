import { NextRequest, NextResponse } from "next/server";
import { geminiModel } from "@/lib/gemini";

export async function POST(req: NextRequest) {
    try {
        const { topic } = await req.json();

        if (!topic) {
            return NextResponse.json({ error: "Topic is required" }, { status: 400 });
        }

        const prompt = `
      You are a professional video script writer for short form content (TikTok, YouTube Shorts).
      Create a 1-minute video script about: "${topic}".
      
      Return ONLY a JSON array of objects, where each object represents a scene.
      Format:
      [
        {
          "text": "Voiceover text for this scene",
          "duration": 5, // estimated duration in seconds
          "visual": "Description of the visual for this scene"
        },
        ...
      ]
      Do not include any markdown formatting (like \`\`\`json). Just the raw JSON.
    `;

        const result = await geminiModel.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Clean up markdown if present
        const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();

        try {
            const script = JSON.parse(cleanText);
            return NextResponse.json({ script });
        } catch (parseError) {
            console.error("Failed to parse JSON:", cleanText);
            return NextResponse.json({ error: "Failed to parse script", raw: text }, { status: 500 });
        }

    } catch (error) {
        console.error("Error generating script:", error);
        return NextResponse.json({ error: "Failed to generate script" }, { status: 500 });
    }
}
