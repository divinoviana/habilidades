
import { GoogleGenAI, Type } from "@google/genai";
import { Question, Subject } from "../types";

// Função auxiliar para instanciar a IA com a chave de ambiente mais recente
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

    if (!response.text) throw new Error("A IA retornou uma resposta vazia.");
    return JSON.parse(response.text);
  } catch (error: any) {
    console.error("Erro Gemini:", error);
    if (error.status === 429 || error.message?.includes("429")) {
      throw new Error("Limite de uso da IA atingido. Por favor, aguarde 1 minuto e tente novamente. Se o erro persistir, a cota diária gratuita pode ter acabado.");
    }
    throw new Error("Falha ao gerar conteúdo com IA: " + (error.message || "Erro desconhecido"));
  }
}

export async function generateAIFeedback(
  subject: Subject,
  questions: Question[],
  answers: number[]
): Promise<string> {
  try {
    const ai = getAI();
    const prompt = `Analise o desempenho de um estudante na avaliação de ${subject}.
    Questões e Respostas: ${JSON.stringify(questions.map((q, i) => ({ q: q.text, correct: q.correctIndex, student: answers[i] })))}
    Forneça um feedback pedagógico incentivador em português, apontando os pontos de melhoria e explicando os conceitos que o aluno errou de forma socrática.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt
    });

    return response.text || "Não foi possível gerar o feedback automático no momento.";
  } catch (error: any) {
    if (error.status === 429) {
      return "O Tutor de IA está muito ocupado no momento (limite de cota). Mas sua nota foi salva com sucesso!";
    }
    return "Feedback indisponível no momento: " + (error.message || "Erro de conexão");
  }
}
