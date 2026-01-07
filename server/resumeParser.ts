import { invokeLLM } from "./_core/llm";

/**
 * AI-powered resume parsing service
 * Extracts structured data from resume text using LLM
 */

export interface ParsedResume {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  summary?: string;
  skills: string[];
  experience: Array<{
    company: string;
    title: string;
    startDate: string;
    endDate: string;
    description: string;
  }>;
  education: Array<{
    institution: string;
    degree: string;
    field: string;
    graduationDate: string;
  }>;
  certifications: string[];
  languages: string[];
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
}

/**
 * Parse resume text and extract structured information
 */
export async function parseResumeText(resumeText: string): Promise<ParsedResume> {
  try {
    const prompt = `You are an expert resume parser. Extract all relevant information from the following resume text and structure it in a standardized format.

Resume Text:
${resumeText}

Extract the following information:
1. Personal information (name, email, phone, location)
2. Professional summary
3. Skills (technical and soft skills)
4. Work experience (company, title, dates, description)
5. Education (institution, degree, field, graduation date)
6. Certifications
7. Languages
8. Social profiles (LinkedIn, GitHub, portfolio)

Return the data in a structured JSON format.`;

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are an expert resume parser that extracts structured information from resumes with high accuracy.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "parsed_resume",
          strict: true,
          schema: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "Full name of the candidate",
              },
              email: {
                type: "string",
                description: "Email address",
              },
              phone: {
                type: "string",
                description: "Phone number",
              },
              location: {
                type: "string",
                description: "Current location or address",
              },
              summary: {
                type: "string",
                description: "Professional summary or objective",
              },
              skills: {
                type: "array",
                items: { type: "string" },
                description: "List of skills",
              },
              experience: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    company: { type: "string" },
                    title: { type: "string" },
                    startDate: { type: "string" },
                    endDate: { type: "string" },
                    description: { type: "string" },
                  },
                  required: ["company", "title", "startDate", "endDate", "description"],
                  additionalProperties: false,
                },
                description: "Work experience history",
              },
              education: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    institution: { type: "string" },
                    degree: { type: "string" },
                    field: { type: "string" },
                    graduationDate: { type: "string" },
                  },
                  required: ["institution", "degree", "field", "graduationDate"],
                  additionalProperties: false,
                },
                description: "Educational background",
              },
              certifications: {
                type: "array",
                items: { type: "string" },
                description: "Professional certifications",
              },
              languages: {
                type: "array",
                items: { type: "string" },
                description: "Languages spoken",
              },
              linkedinUrl: {
                type: "string",
                description: "LinkedIn profile URL",
              },
              githubUrl: {
                type: "string",
                description: "GitHub profile URL",
              },
              portfolioUrl: {
                type: "string",
                description: "Portfolio or personal website URL",
              },
            },
            required: ["skills", "experience", "education", "certifications", "languages"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content || typeof content !== "string") {
      throw new Error("No response from LLM");
    }

    const parsed = JSON.parse(content) as ParsedResume;
    return parsed;
  } catch (error) {
    console.error("Error parsing resume:", error);
    throw new Error("Failed to parse resume");
  }
}

/**
 * Convert parsed resume data to user profile format
 */
export function resumeToProfileData(parsed: ParsedResume) {
  // Combine skills into a comma-separated string
  const skills = parsed.skills.join(", ");

  // Format experience as text
  const experience = parsed.experience
    .map(
      (exp) =>
        `${exp.title} at ${exp.company} (${exp.startDate} - ${exp.endDate})\n${exp.description}`
    )
    .join("\n\n");

  // Format education as text
  const education = parsed.education
    .map((edu) => `${edu.degree} in ${edu.field} from ${edu.institution} (${edu.graduationDate})`)
    .join("\n");

  // Calculate years of experience
  const yearsOfExperience = parsed.experience.length > 0 ? parsed.experience.length * 2 : 0;

  return {
    skills,
    experience: `${yearsOfExperience}+ years of experience\n\n${experience}`,
    education,
    linkedinUrl: parsed.linkedinUrl,
    githubUrl: parsed.githubUrl,
    portfolioUrl: parsed.portfolioUrl,
  };
}

/**
 * Extract text from PDF buffer (placeholder - would use pdf parsing library)
 */
export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  // In a real implementation, use a library like pdf-parse or pdfjs
  // For now, return a placeholder
  throw new Error("PDF parsing not yet implemented. Please use a PDF to text converter.");
}

/**
 * Extract text from DOCX buffer (placeholder - would use docx parsing library)
 */
export async function extractTextFromDOCX(buffer: Buffer): Promise<string> {
  // In a real implementation, use a library like mammoth or docx
  // For now, return a placeholder
  throw new Error("DOCX parsing not yet implemented. Please use a DOCX to text converter.");
}
