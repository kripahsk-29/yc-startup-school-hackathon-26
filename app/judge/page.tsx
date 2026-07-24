import type { Metadata } from "next";
import JudgeClient from "./judge-client";

export const metadata: Metadata = {
  title: "Which set did a real person choose?",
  description: "A short blind test: pick the set of images chosen by a real person.",
};

export default async function JudgePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const round = typeof params.round === "string" && params.round ? params.round : "v1";
  return <JudgeClient round={round} />;
}
