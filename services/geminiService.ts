import { GoogleGenAI, Type } from "@google/genai";
import { Question, Subject } from "../types";

const getAI = () => {
  const apiKey = process.env.API_KEY || (import.meta as any).env?.VITE_API_KEY;
  if (!apiKey) {
    throw new Error("Chave de API (API_KEY) não encontrada nas configurações do sistema.");
  }
  return new GoogleGenAI({ apiKey });
};

export async function generateEnemAssessment(
  subject: Subject,
  topics: string,
  grade: string
): Promise<Question[]> {
  try {
    const ai = getAI();
    const prompt = `Gere uma avaliação no padrão ENEM para a disciplina de ${subject} para a ${grade} série do Ensino Médio.
    Os tópicos trabalhados foram: ${topics}.
    Gere exatamente 5 questões de múltipla escolha.
    Cada questão deve ter um texto base ou contexto, comando da questão, 5 opções (A-E) e uma explicação detalhada.
    Retorne um array de objetos JSON.`;

    // Using gemini-3-pro-preview for complex reasoning task (standardized exam generation)
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              text: { type: Type.STRING },
              options: { 
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              correctIndex: { type: Type.INTEGER },
              explanation: { type: Type.STRING },
              difficulty: { type: Type.STRING }
            },
            required: ["id", "text", "options", "correctIndex", "explanation", "difficulty"]
          }
        }
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (error: any) {
    throw new Error("Falha ao gerar prova com IA: " + error.message);
  }
}

export async function generateExtraActivity(
  subject: Subject,
  theme: string,
  grade: string
) {
  try {
    const ai = getAI();
    const prompt = `Crie uma Atividade de ${subject} para a ${grade} série sobre: "${theme}".
    Retorne exatamente 3 questões. Algumas de múltipla escolha e pelo menos uma aberta.
    FORMATO JSON OBRIGATÓRIO:
    [{ "question": "texto da pergunta", "type": "multiple" | "open", "options": ["A", "B", "C", "D"], "correctAnswer": 0 }]`;

    // Using gemini-3-pro-preview for generating high-quality educational content
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (error: any) {
    throw new Error("Erro Gemini: " + error.message);
  }
}

export async function evaluateActivitySubmission(
  activity: any,
  studentAnswers: any[]
): Promise<{ score: number; feedback: string }> {
  try {
    const ai = getAI();
    const prompt = `Aja como professor. Atividade: ${JSON.stringify(activity)}. Respostas: ${JSON.stringify(studentAnswers)}. 
    Dê nota 0-10 e feedback. Retorne JSON: { "score": 8, "feedback": "texto" }`;

    // Using gemini-3-pro-preview for complex evaluation and pedagogical scoring
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    return JSON.parse(response.text || '{"score":0,"feedback":"Erro"}');
  } catch (error: any) {
    return { score: 0, feedback: "Falha na correção: " + error.message };
  }
}

export async function generateAIFeedback(
  subject: Subject,
  questions: Question[],
  answers: number[]
): Promise<string> {
  try {
    const ai = getAI();
    const prompt = `Dê um feedback pedagógico incentivador para o aluno em ${subject}. Resultados: ${JSON.stringify(answers)}.`;
    // Using gemini-3-pro-preview for nuanced and high-quality educational feedback
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt
    });
    return response.text || "Feedback indisponível.";
  } catch (error) {
    return "Feedback indisponível.";
  }
}
