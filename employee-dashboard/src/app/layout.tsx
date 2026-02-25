import type { ReactNode } from "react";
import StyledRegistry from "../lib/StyledRegistry"
import "./globals.css";

export const metadata = {
  title: "Employee Estimation Dashboard",
  description: "HR Analytics — Recognition data insights",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <StyledRegistry>{children}</StyledRegistry>
      </body>
    </html>
  );
}