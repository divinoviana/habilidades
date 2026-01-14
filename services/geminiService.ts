
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
    const prompt = `Aja como um especialista em elaboração de itens do ENEM para a área de Ciências Humanas da Escola Estadual Frederico José Pedreira.
    Gere uma avaliação oficial para ${subject} (${grade} série) focada rigorosamente no planejamento: "${topics}".
    
    REQUISITOS OBRIGATÓRIOS:
    1. Gere exatamente 5 questões de múltipla escolha com 5 alternativas (A-E) cada.
    2. Cada questão DEVE obrigatoriamente ter um "citation" (Texto-base: fragmento de obra clássica, artigo científico, documento histórico ou notícia relevante). O texto deve ser denso e permitir análise.
    3. O comando da questão deve exigir obrigatoriamente a interpretação ou associação com o texto-base fornecido.
    4. Não mencione imagens, gráficos ou tabelas, foque 100% na análise textual.
    5. Distribua as dificuldades entre easy, medium e hard.

    RETORNE UM ARRAY JSON DE OBJETOS COM ESTA ESTRUTURA:
    [{
      "id": "string_uuid",
      "citation": "texto_base_completo",
      "text": "comando_da_pergunta",
      "options": ["Alternativa A", "Alternativa B", "Alternativa C", "Alternativa D", "Alternativa E"],
      "correctIndex": 0-4,
      "explanation": "justificativa_pedagogica_da_resposta",
      "difficulty": "easy|medium|hard"
    }]`;

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

    const parsed = JSON.parse(response.text || "[]");
    return parsed.slice(0, 5);
  } catch (error: any) {
    throw new Error("Falha ao gerar avaliação: " + error.message);
  }
}

export async function generateExtraActivity(
  subject: Subject,
  theme: string,
  grade: string
) {
  try {
    const ai = getAI();
    const prompt = `Crie uma Atividade Extra de ${subject} (${grade} série) sobre o tema: "${theme}".
    
    REQUISITOS:
    1. Gere 5 questões mesclando múltipla escolha e abertas.
    2. Use citações textuais (citation) ricas em conteúdo histórico/filosófico para cada questão.
    3. Foque na análise crítica do texto. Não utilize referências visuais.
    
    FORMATO JSON ESTRITO:
    [{ 
      "id": "string",
      "citation": "texto base rico",
      "question": "comando interpretativo", 
      "type": "multiple" ou "open", 
      "options": ["opção A", "opção B", "opção C", "opção D"], 
      "correctAnswer": 0 
    }]`;

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

    const parsed = JSON.parse(response.text || "[]");
    return parsed.slice(0, 5);
  } catch (error: any) {
    throw new Error("Erro Gemini (Atividade): " + error.message);
  }
}

export async function evaluateActivitySubmission(
  activity: any,
  studentAnswers: any[]
): Promise<{ score: number; feedback: string }> {
  try {
    const ai = getAI();
    const prompt = `Aja como professor de Ciências Humanas. Corrija a atividade: ${JSON.stringify(activity)}. Respostas enviadas pelo aluno: ${JSON.stringify(studentAnswers)}. Avalie o domínio do conteúdo e a capacidade de interpretação. Retorne JSON: { "score": 0-10, "feedback": "texto explicativo" }`;
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { responseMimeType: "application/json" }
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
    const prompt = `Gere um feedback pedagógico motivador e analítico para um aluno de ${subject}. Analise o desempenho baseado nestas questões: ${JSON.stringify(questions)} e nestas respostas: ${JSON.stringify(answers)}. Foque em pontos de melhoria na interpretação de textos.`;
    const response = await ai.models.generateContent({ model: "gemini-3-flash-preview", contents: prompt });
    return response.text || "Continue estudando seus textos base!";
  } catch (error) {
    return "Feedback indisponível no momento.";
  }
}
