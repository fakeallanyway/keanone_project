export const settingsSchema = z.object({
  termsAndConditions: z.string(),
  privacyPolicy: z.string(),
  aboutUs: z.string(),
  // ... другие поля
}); 