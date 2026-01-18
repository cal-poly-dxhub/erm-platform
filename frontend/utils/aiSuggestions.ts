import { aiKeywordMapping, severityKeywordMapping, impacts } from "./constants";

interface Suggestion {
  category: string;
  impact: {
    value: string;
    text: string;
  } | null;
}

export const analyzeTextForSuggestions = (riskText: string, riskAnalysisText: string): Suggestion | null => {
  const text = `${riskText} ${riskAnalysisText}`.toLowerCase();

  if (text.trim().length < 20) {
    return null;
  }

  // Count matches for categories
  const categoryScores: Record<string, number> = {};
  for (const category in aiKeywordMapping) {
    categoryScores[category] = 0;
    aiKeywordMapping[category as keyof typeof aiKeywordMapping].forEach((keyword) => {
      if (text.includes(keyword)) {
        categoryScores[category]++;
      }
    });
  }

  // Find the category with highest score
  const suggestedCategory = Object.keys(categoryScores).reduce((a, b) =>
    categoryScores[a] > categoryScores[b] ? a : b
  );

  // Check for severity/impact
  let suggestedImpact: string | null = null;
  for (const impactVal in severityKeywordMapping) {
    const impactKey = parseInt(impactVal) as keyof typeof severityKeywordMapping;
    severityKeywordMapping[impactKey].forEach((keyword) => {
      if (text.includes(keyword)) {
        if (
          suggestedImpact === null ||
          impactKey > parseInt(suggestedImpact)
        ) {
          suggestedImpact = impactVal;
        }
      }
    });
  }

  if (categoryScores[suggestedCategory] > 0) {
    return {
      category: suggestedCategory,
      impact: suggestedImpact
        ? {
            value: suggestedImpact,
            text:
              impacts.find((i) => i.value === parseInt(suggestedImpact!))?.text ||
              "Unknown",
          }
        : null,
    };
  }

  return null;
};
