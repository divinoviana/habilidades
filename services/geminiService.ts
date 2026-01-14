
import { GoogleGenAI, Type } from "@google/genai";
import { Question, Subject } from "../types";

const getAI = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY as string });
};

const SYSTEM_INSTRUCTION = `Aja como um especialista em elaboração de itens do ENEM para a área de Ciências Humanas da Escola Estadual Frederico José Pedreira.
Siga rigorosamente estas regras:
1. Gere EXATAMENTE 5 questões de múltipla escolha (A-E).
2. Cada questão DEVE ter um "citation" (Texto-base denso, fragmento de obra clássica ou documento histórico).
3. O comando da questão DEVE exigir análise do texto.
4. NUNCA mencione imagens, gráficos ou tabelas.
5. Retorne APENAS o JSON puro, sem markdown ou textos extras.`;

export async function generateEnemAssessment(
  subject: Subject,
  topics: string,
  grade: string
): Promise<Question[]> {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Gere uma avaliação de ${subject} para a ${grade} série baseada neste planejamento: "${topics}".`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        thinkingConfig: { thinkingBudget: 0 }, // Velocidade máxima
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              citation: { type: Type.STRING },
              text: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              correctIndex: { type: Type.INTEGER },
              explanation: { type: Type.STRING },
              difficulty: { type: Type.STRING }
            },
            required: ["id", "citation", "text", "options", "correctIndex", "explanation", "difficulty"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("A IA retornou uma resposta vazia.");
    
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("A IA não gerou o formato de questões esperado.");
    
    return parsed.slice(0, 5);
  } catch (error: any) {
    console.error("Erro Gemini:", error);
    throw new Error(error.message || "Falha na comunicação com o servidor de IA.");
  }
}

export async function generateExtraActivity(
  subject: Subject,
  theme: string,
  grade: string
) {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Crie uma atividade de ${subject} (${grade} série) sobre: "${theme}". Misture questões abertas e fechadas.`,
      config: {
        systemInstruction: `Crie uma atividade escolar com 5 questões. Use citações textuais densas. Não use imagens. Retorne JSON estruturado.`,
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              citation: { type: Type.STRING },
              question: { type: Type.STRING },
              type: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
              correctAnswer: { type: Type.INTEGER, nullable: true }
            },
            required: ["id", "citation", "question", "type"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Sem resposta da IA.");
    return JSON.parse(text).slice(0, 5);
  } catch (error: any) {
    throw new Error("Erro ao gerar atividade: " + error.message);
  }
}

export async function evaluateActivitySubmission(
  activity: any,
  studentAnswers: any[]
): Promise<{ score: number; feedback: string }> {
  try {
    const ai = getAI();
    const prompt = `Corrija: ${JSON.stringify(activity)}. Respostas: ${JSON.stringify(studentAnswers)}.`;
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { 
        systemInstruction: 'Aja como professor de Humanas. Dê nota 0-10 e feedback analítico em JSON.',
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: "application/json" 
      }
    });
    return JSON.parse(response.text || '{"score":0,"feedback":"Erro na correção."}');
  } catch (error) {
    return { score: 0, feedback: "Falha na correção automática." };
  }
}

export async function generateAIFeedback(
  subject: Subject,
  questions: Question[],
  answers: number[]
): Promise<string> {
  try {
    const ai = getAI();
    const prompt = `Analise: ${JSON.stringify(questions)} | Respostas: ${JSON.stringify(answers)}.`;
    const response = await ai.models.generateContent({ 
      model: "gemini-3-flash-preview", 
      contents: prompt,
      config: {
        systemInstruction: `Gere um feedback motivador focado em interpretação de texto para o aluno de ${subject}. Seja breve e direto.`,
        thinkingConfig: { thinkingBudget: 0 }
      }
    });
    return response.text || "Continue estudando seus textos base!";
  } catch (error) {
    return "Feedback indisponível no momento.";
  }
}
