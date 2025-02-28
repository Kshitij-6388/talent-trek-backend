import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { configDotenv } from "dotenv";

configDotenv();

const app = new Hono();

app.use("*", cors({
  origin: ["http://localhost:5174", "https://talenttrek.vercel.app/"],
}));

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

app.post("/api/generate-interview-questions", async (c) => {
  try {
    const { jobTitle } = await c.req.json();
console.log(jobTitle)
    if (!jobTitle) {
      return c.json({ error: "No job title provided" }, 400);
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const prompt = `
      You are an expert in generating interview questions . For the job title provided, generate 10 concise interview questions and answers. Each question must be under 15 words, and each answer under 30 words. Use simple language, avoid special characters, symbols, or Markdown. Return the result as a JSON array with objects containing:
      - id: number (1 to 10)
      - question: string
      - answer: string
      Format for job title: ${jobTitle}.
      No formatting or extra characters
      Example output: [{"id": 1, "question": "What is a RESTful API?", "answer": "It uses HTTP methods for CRUD operations and resource-based URLs."}, ...]
    `;

    const result = await model.generateContent(prompt);
    let responseText = result.response.text();
    console.log("Raw response:", responseText); // Log for debugging

    // Clean the response by removing potential Markdown and extra characters
    responseText = responseText
      .replace(/```json/g, '') // Remove opening Markdown
      .replace(/```/g, '')     // Remove closing Markdown
      .replace(/\n/g, '')      // Remove newlines
      .trim();                 // Remove leading/trailing whitespace

    // Parse the cleaned response
    let questions;
    try {
      questions = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Failed to parse response:", responseText);
      throw new Error("Invalid JSON response from AI");
    }

    // Ensure we have exactly 7 questions
    if (!Array.isArray(questions) || questions.length !== 10) {
      throw new Error("Invalid questions format or incorrect number of questions");
    }

    // Validate and format the structure
    const formattedQuestions = questions.map((q: any, index: number) => ({
      id: q.id || index + 1,
      question: q.question || "No question provided",
      answer: q.answer || "No answer provided",
    }));

    return c.json({ questions: formattedQuestions }, 200);
  } catch (error) {
    console.error("Error generating interview questions:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

const PORT = parseInt(process.env.PORT!) || 8000;
serve(
  {
    fetch: app.fetch,
    port: PORT,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  }
);