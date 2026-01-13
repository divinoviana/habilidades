
import { GoogleGenAI, Type } from "@google/genai";
import { Question, Subject } from "../types";

const getAI = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY as string });
};

export async function generateEnemAssessment(
  subject: Subject,
  topics: string,
  grade: string
): Promise<Question[]> {
  try {
    const ai = getAI();
    const prompt = `Aja como um especialista em elaboração de itens do ENEM para a área de Ciências Humanas da Escola Estadual Federico Pedreira.
    Gere uma avaliação oficial para ${subject} (${grade} série) focada rigorosamente no planejamento: "${topics}".
    
    REQUISITOS OBRIGATÓRIOS:
    1. Gere exatamente 5 questões de múltipla escolha com 5 alternativas (A-E) cada.
    2. Cada questão DEVE ter um "citation" (Texto-base: fragmento histórico, geográfico, sociológico ou filosófico).
    3. Pelo menos 2 questões DEVEM ter uma "visualDescription" (Descrição detalhada de charge, mapa ou gráfico).
    4. O comando deve exigir interpretação do texto-base.
    5. Distribua dificuldades entre easy, medium e hard.

    RETORNE UM ARRAY JSON DE OBJETOS COM ESTA ESTRUTURA EXATA:
    [{
      "id": "string_uuid",
      "citation": "texto_base",
      "visualDescription": "descricao_opcional_ou_null",
      "text": "comando_pergunta",
      "options": ["A", "B", "C", "D", "E"],
      "correctIndex": 0-4,
      "explanation": "justificativa",
      "difficulty": "easy|medium|hard"
    }]`;

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
              citation: { type: Type.STRING },
              visualDescription: { type: Type.STRING, nullable: true },
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

    const parsed = JSON.parse(response.text || "[]");
    return parsed.slice(0, 5); // Garante o limite de 5
  } catch (error: any) {
    throw new Error("Falha ao gerar prova: " + error.message);
  }
}

export async function generateExtraActivity(
  subject: Subject,
  theme: string,
  grade: string
) {
  try {
    const ai = getAI();
    const prompt = `Crie uma Atividade Extra de ${subject} (${grade} série) sobre: "${theme}".
    
    REQUISITOS:
    1. Gere exatamente 5 questões (mescla de múltipla escolha e abertas).
    2. Questões abertas (type: "open") não devem ter options nem correctAnswer.
    3. Use citações (citation) e descrições de imagens (visualDescription).
    
    FORMATO JSON ESTRITO:
    [{ 
      "id": "string",
      "citation": "texto base",
      "visualDescription": "descricao_imagem_se_houver",
      "question": "comando", 
      "type": "multiple" ou "open", 
      "options": ["opção A", "opção B", "opção C", "opção D"], 
      "correctAnswer": 0 
    }]`;

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
              citation: { type: Type.STRING },
              visualDescription: { type: Type.STRING, nullable: true },
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

    const parsed = JSON.parse(response.text || "[]");
    return parsed.slice(0, 5); // Garante o limite de 5
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
    const prompt = `Corrija esta atividade de Ciências Humanas. 
    Atividade: ${JSON.stringify(activity)}
    Respostas do Aluno: ${JSON.stringify(studentAnswers)}
    Retorne nota 0-10 e feedback pedagógico curto.
    JSON: { "score": 10, "feedback": "excelente" }`;

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });

    return JSON.parse(response.text || '{"score":0,"feedback":"Erro na correção."}');
  } catch (error) {
    return { score: 0, feedback: "Erro na correção automática." };
  }
}

export async function generateAIFeedback(
  subject: Subject,
  questions: Question[],
  answers: number[]
): Promise<string> {
  try {
    const ai = getAI();
    const prompt = `Gere um feedback pedagógico incentivador (Padrão ENEM) para um aluno de ${subject}.
    Questões: ${JSON.stringify(questions)}
    Respostas: ${JSON.stringify(answers)}`;
    
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt
    });
    return response.text || "Continue estudando!";
  } catch (error) {
    return "Feedback indisponível.";
  }
}
