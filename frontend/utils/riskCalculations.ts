import { qualitativeMatrix, leadershipResponseMap } from "./constants";
import { RiskData } from "@/types";

export const getRiskData = (lVal: string | number | undefined, iVal: string | number | undefined): RiskData => {
  if (!lVal || !iVal) return { score: "-", rating: "-", response: "-" };
  const likelihood = typeof lVal === "string" ? parseInt(lVal) : lVal;
  const impact = typeof iVal === "string" ? parseInt(iVal) : iVal;
  const score = likelihood * impact;
  const rating = (qualitativeMatrix[likelihood as keyof typeof qualitativeMatrix]?.[impact as keyof typeof qualitativeMatrix[1]] || "-") as string;
  const response = (leadershipResponseMap[rating as keyof typeof leadershipResponseMap] || "-") as string;
  return { score, rating, response };
};
