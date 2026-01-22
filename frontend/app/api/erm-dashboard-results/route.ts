import { NextResponse } from "next/server";

const API_URL =
  "https://0r2exr1sqj.execute-api.us-east-2.amazonaws.com/dev/erm-dashboard-results";

export async function POST(request: Request) {
  const body = await request.text();
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  const responseBody = await response.text();
  return new NextResponse(responseBody, {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}
