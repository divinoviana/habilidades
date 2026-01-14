
import { GoogleGenAI, Type } from "@google/genai";
import { Question, Subject } from "../types";

const getAI = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY não configurada no ambiente.");
  }
  return new GoogleGenAI({ apiKey });
};

const ASSESSMENT_SYSTEM_INSTRUCTION = `Aja como um especialista em elaboração de itens do ENEM para a área de Ciências Humanas da Escola Estadual Frederico José Pedreira.
Siga rigorosamente estas regras:
1. Gere EXATAMENTE 5 questões de múltipla escolha (A-E).
2. Cada questão DEVE ter um "citation" (Texto-base denso, fragmento de obra clássica ou documento histórico).
3. O comando da questão DEVE exigir análise do texto.
4. NUNCA mencione imagens, gráficos ou tabelas.
5. Retorne APENAS o JSON puro, sem markdown ou textos extras.`;

const ACTIVITY_SYSTEM_INSTRUCTION = `Aja como professor de Ciências Humanas. Crie uma Atividade Extra com 5 questões.
REGRAS:
1. Misture obrigatoriamente questões do tipo 'multiple' (múltipla escolha) e 'open' (dissertativa).
2. Para questões 'multiple', forneça exatamente 4 opções e o índice 'correctAnswer'.
3. Para questões 'open', o campo 'options' deve ser um array vazio [] e 'correctAnswer' deve ser null.
4. Cada questão PRECISA de um 'citation' (texto-base rico) de fonte histórica ou filosófica real.
5. Retorne APENAS JSON estruturado conforme o esquema solicitado.`;

export async function generateEnemAssessment(
  subject: Subject,
  topics: string,
  grade: string
): Promise<Question[]> {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Gere uma avaliação oficial de ${subject} (${grade} série) sobre: "${topics}".`,
      config: {
        systemInstruction: ASSESSMENT_SYSTEM_INSTRUCTION,
        thinkingConfig: { thinkingBudget: 0 },
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
    if (!text) throw new Error("A IA não retornou conteúdo.");
    return JSON.parse(text).slice(0, 5);
  } catch (error: any) {
    console.error("Erro na Geração de Prova:", error);
    throw new Error(error.message || "Falha ao comunicar com o servidor de IA.");
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
      contents: `Gere uma atividade extra de ${subject} para ${grade} série sobre o tema: "${theme}".`,
      config: {
        systemInstruction: ACTIVITY_SYSTEM_INSTRUCTION,
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
    if (!text) throw new Error("A IA retornou um campo de texto vazio para a atividade.");
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed.slice(0, 5) : [];
  } catch (error: any) {
    console.error("Erro na Geração de Atividade:", error);
    throw new Error("Erro Gemini (Atividade): " + error.message);
  }
}

export async function evaluateActivitySubmission(
  activity: any,
  studentAnswers: any[]
): Promise<{ score: number; feedback: string }> {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Corrija esta atividade: ${JSON.stringify(activity)}. Respostas do aluno: ${JSON.stringify(studentAnswers)}.`,
      config: { 
        systemInstruction: 'Dê nota 0-10 e feedback analítico como professor de Ciências Humanas em JSON.',
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
    const response = await ai.models.generateContent({ 
      model: "gemini-3-flash-preview", 
      contents: `Analise o desempenho nestas questões: ${JSON.stringify(questions)} com estas respostas: ${JSON.stringify(answers)}.`,
      config: {
        systemInstruction: `Gere um feedback pedagógico curto e motivador para um aluno de ${subject}.`,
        thinkingConfig: { thinkingBudget: 0 }
      }
    });
    return response.text || "Continue estudando!";
  } catch (error) {
    return "Feedback indisponível.";
  }
}
