import { Risk } from "@/types";

const STORAGE_KEY = "riskAssessmentToolData";

export const saveToLocalStorage = (risks: Risk[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(risks));
  } catch (error) {
    console.error("Error saving to localStorage:", error);
  }
};

export const loadFromLocalStorage = (): Risk[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? (JSON.parse(data) as Risk[]) : [];
  } catch (error) {
    console.error("Error loading from localStorage:", error);
    return [];
  }
};
