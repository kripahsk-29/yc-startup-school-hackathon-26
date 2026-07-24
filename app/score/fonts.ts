import { Bricolage_Grotesque, Inter } from "next/font/google";

// Display face — characterful, used with restraint for the number + verdict.
// Not the serif every AI reaches for.
export const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--tt-display",
  display: "swap",
});

// Body face — clean, quiet, for everything else.
export const body = Inter({
  subsets: ["latin"],
  variable: "--tt-body",
  display: "swap",
});
