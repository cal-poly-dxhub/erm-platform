// Next.js uses process.env.NEXT_PUBLIC_ for client-side env vars
const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";

export const generateMitigationSteps = async (
  riskDescription: string,
  riskAnalysis: string,
  currentControls?: string
): Promise<string> => {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === "") {
    throw new Error(
      "Please set NEXT_PUBLIC_GEMINI_API_KEY environment variable in .env.local or configure the API key in utils/gemini.ts"
    );
  }

  if (!riskDescription || !riskAnalysis) {
    throw new Error(
      'Please provide a "Risk" and "Risk Analysis" before suggesting mitigation steps.'
    );
  }

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${GEMINI_API_KEY}`;

  const systemPrompt =
    "You are an expert university risk management consultant. Your task is to provide concise, actionable mitigation strategies. Based on the provided risk information, generate a numbered list of 3 to 5 practical control measures that could be implemented to reduce the likelihood or impact of the risk. Focus on realistic steps a university could take.";

  const userQuery = `
    Here is the risk I am assessing:
    **Risk:** ${riskDescription}
    **Risk Analysis:** ${riskAnalysis}
    **Current Control Measures in Place:** ${
      currentControls || "None specified."
    }

    Please suggest additional control measures.`;

  const payload = {
    contents: [{ parts: [{ text: userQuery }] }],
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
  };

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.json();
    throw new Error(
      `API call failed with status: ${response.status}. ${
        errorBody.error?.message || "Unknown error"
      }`
    );
  }

  const result = await response.json();
  const candidate = result.candidates?.[0];

  if (candidate && candidate.content?.parts?.[0]?.text) {
    return candidate.content.parts[0].text;
  } else {
    let errorMessage = "The API returned an empty response.";
    if (candidate && candidate.finishReason) {
      errorMessage += ` (Finish Reason: ${candidate.finishReason})`;
    }
    if (result.promptFeedback && result.promptFeedback.blockReason) {
      errorMessage += ` (Block Reason: ${result.promptFeedback.blockReason})`;
    }
    throw new Error(errorMessage);
  }
};
