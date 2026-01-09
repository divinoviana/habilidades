
import { GoogleGenAI, Type } from "@google/genai";
import { Question, Subject } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function generateEnemAssessment(
  subject: Subject,
  topics: string,
  grade: string
): Promise<Question[]> {
  const prompt = `Gere uma avaliação no padrão ENEM para a disciplina de ${subject} para a ${grade} série do Ensino Médio.
  Os tópicos trabalhados foram: ${topics}.
  Gere exatamente 5 questões de múltipla escolha.
  As questões devem seguir a Teoria da Resposta ao Item (TRI): 1 fácil, 3 médias e 1 difícil.
  Cada questão deve ter um texto base ou contexto, comando da questão, 5 opções (A-E) e uma explicação detalhada.
  Retorne um array de objetos JSON.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
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

  return JSON.parse(response.text);
}

export async function generateAIFeedback(
  subject: Subject,
  questions: Question[],
  answers: number[]
): Promise<string> {
  const prompt = `Analise o desempenho de um estudante na avaliação de ${subject}.
  Questões e Respostas: ${JSON.stringify(questions.map((q, i) => ({ q: q.text, correct: q.correctIndex, student: answers[i] })))}
  Forneça um feedback pedagógico incentivador, apontando os pontos de melhoria e explicando os conceitos que o aluno errou de forma socrática.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt
  });

  return response.text;
}
