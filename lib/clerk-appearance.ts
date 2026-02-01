export const clerkAppearance = {
  variables: {
    colorPrimary: "hsl(222.2 47.4% 11.2%)", // matches shadcn "foreground-ish"
    colorText: "hsl(222.2 84% 4.9%)",
    colorTextSecondary: "hsl(215.4 16.3% 46.9%)",
    colorBackground: "hsl(0 0% 100%)",
    colorInputBackground: "hsl(0 0% 100%)",
    colorInputText: "hsl(222.2 84% 4.9%)",
    borderRadius: "0.75rem",
  },
  elements: {
    // Main card inside Clerk
    card: "shadow-none bg-transparent border-0",
    headerTitle: "text-xl font-semibold tracking-tight",
    headerSubtitle: "text-sm text-muted-foreground",

    // Inputs / buttons
    formFieldLabel: "text-sm font-medium",
    formFieldInput:
      "h-10 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-ring focus:ring-offset-2",
    formButtonPrimary:
      "h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 focus:ring-2 focus:ring-ring focus:ring-offset-2",

    // Links + dividers
    footerActionLink: "text-primary hover:underline",
    dividerLine: "bg-border",
    dividerText: "text-muted-foreground",

    // Social buttons
    socialButtonsBlockButton:
      "h-10 rounded-md border border-input bg-background text-sm hover:bg-accent hover:text-accent-foreground",
    socialButtonsBlockButtonText: "font-medium",

    // OTP / code inputs (if enabled)
    otpCodeFieldInput:
      "h-10 w-10 rounded-md border border-input bg-background text-center text-sm shadow-sm",
  },
} as const
 