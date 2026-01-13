
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
    const prompt = `Aja como um especialista em elaboração de itens do ENEM para a área de Ciências Humanas.
    Gere uma avaliação oficial para ${subject} (${grade} série) focada em: "${topics}".
    
    REQUISITOS OBRIGATÓRIOS:
    1. Gere exatamente 5 questões de múltipla escolha.
    2. Cada questão deve possuir um "citation" (Texto-base: fragmento de livro, documento histórico, citação filosófica ou artigo científico).
    3. Pelo menos 2 questões devem incluir um "visualDescription" (Descrição detalhada de um mapa, gráfico, infográfico ou charge para o aluno analisar).
    4. O comando da questão deve exigir análise crítica do texto-base fornecido.
    5. Distribua as dificuldades entre easy, medium e hard.

    RETORNE UM ARRAY JSON DE OBJETOS:
    {
      "id": "string única",
      "citation": "texto ou citação",
      "visualDescription": "descrição do elemento visual ou null",
      "text": "comando da questão",
      "options": ["A", "B", "C", "D", "E"],
      "correctIndex": número de 0 a 4,
      "explanation": "justificativa pedagógica",
      "difficulty": "easy" | "medium" | "hard"
    }`;

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
    const prompt = `Crie uma Atividade Extra de ${subject} (${grade} série) sobre o tema: "${theme}".
    
    REQUISITOS:
    1. Gere exatamente 5 questões variadas (múltipla escolha e abertas).
    2. Use citações (citation) e descrições de imagens (visualDescription) em pelo menos 2 questões.
    3. Nível de linguagem adequado para o Ensino Médio.
    
    FORMATO JSON:
    [{ 
      "id": "string",
      "citation": "texto base",
      "visualDescription": "descrição visual opcional",
      "question": "texto da pergunta", 
      "type": "multiple" | "open", 
      "options": ["A", "B", "C", "D"], 
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
    const prompt = `Aja como professor da área de Ciências Humanas da Escola Estadual Federico Pedreira. 
    Analise a atividade: ${JSON.stringify(activity)} e as respostas do aluno: ${JSON.stringify(studentAnswers)}. 
    Considere a profundidade teórica e a coerência histórica/sociológica.
    Dê nota 0-10 e um feedback detalhado. 
    Retorne JSON: { "score": 8, "feedback": "texto" }`;

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    return JSON.parse(response.text || '{"score":0,"feedback":"Erro na correção automática."}');
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
    const prompt = `Analise o desempenho do aluno em ${subject}. 
    Questões: ${JSON.stringify(questions)}. 
    Respostas do Aluno: ${JSON.stringify(answers)}. 
    Gere um feedback pedagógico incentivador no padrão de tutoria escolar, apontando pontos fortes e o que revisar para melhorar a nota no ENEM.`;
    
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt
    });
    return response.text || "Feedback indisponível no momento.";
  } catch (error) {
    return "Feedback indisponível no momento.";
  }
}
