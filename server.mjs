
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();

// ==================================================
// MIDDLEWARE
// ==================================================

app.use(cors());

// Allow PDF converted to Base64 to be sent in JSON
app.use(express.json({ limit: "20mb" }));

// ==================================================
// GEMINI AI
// ==================================================

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// ==================================================
// TEST BACKEND
// ==================================================

app.get("/", (req, res) => {
  res.json({
    message: "Interview Agent backend is running!",
  });
});

// ==================================================
// RESUME ANALYSIS
// ==================================================

app.post("/api/analyze", async (req, res) => {
  try {
    const { resumeText, fileType } = req.body;

    // ------------------------------------------------
    // CHECK PDF DATA
    // ------------------------------------------------

    if (!resumeText) {
      return res.status(400).json({
        error: "Resume PDF is required.",
      });
    }

    console.log("=================================");
    console.log("Resume received for analysis.");
    console.log("File type:", fileType || "application/pdf");
    console.log("Base64 data length:", resumeText.length);
    console.log("=================================");

    // ------------------------------------------------
    // RESUME ANALYSIS PROMPT
    // ------------------------------------------------

    const prompt = `
You are an expert technical interviewer and professional resume analyst.

Analyze the attached candidate resume PDF carefully.

IMPORTANT RULES:

1. Read the actual information contained in the PDF.
2. Do NOT invent candidate information.
3. Do NOT assume skills, experience, projects, education or certifications that are not present.
4. Use ONLY information available in the resume.
5. If information is missing, say "Not mentioned in the resume."
6. Base the interview questions specifically on the candidate's actual resume.
7. Do not make an automatic hiring or rejection decision.

Analyze:

- Candidate name
- Contact/professional information if relevant
- Education
- Work experience
- Internships
- Projects
- Programming languages
- Technical skills
- Frameworks
- Databases
- Tools
- Cloud/DevOps technologies
- Certifications
- Achievements
- Relevant experience

Return the response in Markdown.

Use EXACTLY these sections:

# 📋 Resume Summary

Give a concise professional summary based ONLY on the actual resume.

# 🛠️ Technical Skills

List the technical skills found in the resume.

Organize them where appropriate:

- Programming Languages
- Frameworks / Libraries
- Databases
- Tools
- Cloud / DevOps
- Other Technical Skills

# 💼 Suitable Roles

List the 3 most suitable job roles based specifically on the candidate's actual education, skills, projects and experience.

Explain briefly why each role is suitable.

# 🎯 Personalized Interview Questions

Generate 5 interview questions based specifically on the candidate's resume.

The questions should test the candidate's actual knowledge of technologies, projects, concepts and experience mentioned in the resume.

Avoid generic questions whenever possible.

# 📚 Areas to Improve

Identify 3 to 5 technical areas the candidate should improve.

Base these recommendations on gaps or weaknesses visible in the resume.

# ⭐ Overall Assessment

Give a concise assessment of the candidate's current interview readiness.

Mention:

- Strong areas
- Potential weaknesses
- Technical readiness
- Areas that should be investigated during the interview

Do NOT make a final hiring or rejection decision.

The final employment decision must remain with a human HR/recruiter.
`;

    // ------------------------------------------------
    // SEND ACTUAL PDF TO GEMINI
    // ------------------------------------------------

    console.log("Sending PDF to Gemini...");

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",

      contents: [
        {
          inlineData: {
            mimeType: fileType || "application/pdf",
            data: resumeText,
          },
        },
        {
          text: prompt,
        },
      ],
    });

    // ------------------------------------------------
    // CHECK GEMINI RESPONSE
    // ------------------------------------------------

    console.log("Gemini resume analysis completed.");

    if (!response.text) {
      throw new Error("Gemini returned an empty response.");
    }

    // ------------------------------------------------
    // SEND ANALYSIS TO FRONTEND
    // ------------------------------------------------

    res.json({
      analysis: response.text,
    });

  } catch (error) {
    console.error("=================================");
    console.error("Gemini resume analysis error:");
    console.error(error);
    console.error("=================================");

    res.status(500).json({
      error: "Failed to analyze resume.",
      details: error.message,
    });
  }
});

// ==================================================
// ADAPTIVE INTERVIEW
// ==================================================

app.post("/api/interview", async (req, res) => {
  try {
    const {
      resume,
      question,
      answer,
      history,
    } = req.body;

    // ------------------------------------------------
    // VALIDATION
    // ------------------------------------------------

    if (!resume) {
      return res.status(400).json({
        error: "Resume analysis is required.",
      });
    }

    if (!question) {
      return res.status(400).json({
        error: "Current question is required.",
      });
    }

    if (!answer) {
      return res.status(400).json({
        error: "Candidate answer is required.",
      });
    }

    console.log("=================================");
    console.log("Interview answer received.");
    console.log("Current question:", question);
    console.log("Answer:", answer);
    console.log("=================================");

    // ------------------------------------------------
    // ADAPTIVE INTERVIEW PROMPT
    // ------------------------------------------------

    const prompt = `
You are an adaptive technical interviewer.

You are interviewing a candidate based on their resume.

RESUME ANALYSIS:
${resume}

CURRENT QUESTION:
${question}

CANDIDATE ANSWER:
${answer}

PREVIOUS INTERVIEW HISTORY:
${JSON.stringify(history || [])}

Your job is to:

1. Evaluate the candidate's current answer.
2. Identify what the candidate answered well.
3. Identify missing or weak points.
4. Give a score from 0 to 10.
5. Determine the candidate's current level of understanding.
6. Decide what should be tested next.
7. Generate ONE follow-up interview question.

IMPORTANT ADAPTIVE RULES:

- The next question MUST depend on the candidate's previous answer.
- Do NOT generate a random unrelated question.
- If the answer is shallow, ask a deeper question about the same concept.
- If the answer is partially correct, test the missing part.
- If the answer is strong, increase the difficulty.
- If the answer is weak, ask a simpler foundational question.
- Questions should be relevant to the candidate's resume.
- Do not repeat questions already asked.
- Test technical understanding and reasoning.
- Test problem-solving ability when appropriate.
- Ask ONLY ONE next question.
- The next question should naturally follow from the candidate's answer.

SCORING:

0-2 = Very weak understanding
3-4 = Limited understanding
5-6 = Basic/moderate understanding
7-8 = Good understanding
9-10 = Excellent understanding

Return ONLY valid JSON.

Use EXACTLY this structure:

{
  "evaluation": {
    "score": 0,
    "strengths": [],
    "weaknesses": [],
    "feedback": ""
  },
  "nextQuestion": ""
}
`;

    // ------------------------------------------------
    // GEMINI REQUEST
    // ------------------------------------------------

    console.log("Sending answer to Gemini...");

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",

      contents: prompt,

      config: {
        responseMimeType: "application/json",
      },
    });

    // ------------------------------------------------
    // PARSE RESPONSE
    // ------------------------------------------------

    if (!response.text) {
      throw new Error("Gemini returned an empty interview response.");
    }

    console.log("Gemini interview response:");
    console.log(response.text);

    const result = JSON.parse(response.text);

    // ------------------------------------------------
    // VALIDATE RESULT
    // ------------------------------------------------

    if (!result.nextQuestion) {
      throw new Error("Gemini did not return a nextQuestion.");
    }

    if (!result.evaluation) {
      throw new Error("Gemini did not return an evaluation.");
    }

    // ------------------------------------------------
    // SEND RESPONSE TO FRONTEND
    // ------------------------------------------------

    res.json(result);

  } catch (error) {
    console.error("=================================");
    console.error("Interview error:");
    console.error(error);
    console.error("=================================");

    res.status(500).json({
      error: "Failed to generate next interview question.",
      details: error.message,
    });
  }
});

// ==================================================
// START SERVER
// ==================================================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("=================================");
  console.log(`Backend running on port ${PORT}`);
  console.log("=================================");
});

