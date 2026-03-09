import { z } from "zod";

const PHONE_REGEX =
    /^(\+?[1-9]\d{0,2}[\s.-]?)?(\(?\d{3}\)?[\s.-]?)?\d{3}[\s.-]?\d{4}$/;

const timezoneValues = [
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Phoenix",
    "America/Anchorage",
    "Pacific/Honolulu",
    "America/Toronto",
    "America/Vancouver",
    "Europe/London",
    "Europe/Paris",
    "Asia/Tokyo",
] as const;

const modeValues = [
    "IN_PERSON",
    "REMOTE",
    "VIDEO_RELAY",
    "VIDEO_REMOTE",
] as const;

function cleanTagArray(values: string[]) {
    return Array.from(
        new Set(
            values
                .map((v) => v.trim())
                .filter(Boolean)
        )
    );
}

const tagSchema = z
    .string()
    .trim()
    .min(2, "Must be at least 2 characters")
    .max(50, "Must be 50 characters or less")
    .regex(/^[A-Za-z0-9 .:/&+\-()#]+$/, "Contains invalid characters");

export const basicInfoSchema = z.object({
    displayName: z
        .string()
        .trim()
        .min(2, "Enter your name")
        .max(80, "Name is too long"),

    phone: z
        .string()
        .trim()
        .min(1, "Enter a phone number")
        .regex(PHONE_REGEX, "Enter a valid phone number"),

    location: z
        .string()
        .trim()
        .min(2, "Enter your location")
        .max(120, "Location is too long"),

    bio: z
        .string()
        .trim()
        .min(20, "Add a short professional summary")
        .max(1000, "Bio must be 1000 characters or less"),

    experienceYears: z
        .number()
        .int("Use a whole number")
        .min(0, "Cannot be negative")
        .max(60, "That seems too high"),

    timezone: z.enum(timezoneValues, "Select a valid timezone"),
});

export const credentialsSchema = z.object({
    languages: z
        .array(tagSchema)
        .transform(cleanTagArray)
        .refine((v) => v.length > 0, "Add at least one language pair")
        .refine((v) => v.length <= 12, "Too many language pairs"),
    certifications: z
        .array(tagSchema)
        .transform(cleanTagArray)
        .refine((v) => v.length <= 12, "Too many certifications"),
});

export const preferencesSchema = z.object({
    preferredModes: z
        .array(z.enum(modeValues))
        .refine((v) => v.length > 0, "Select at least one modality"),
});

export const fullInterpreterProfileSchema = basicInfoSchema
    .merge(credentialsSchema)
    .merge(preferencesSchema);

export type BasicInfoInput = z.infer<typeof basicInfoSchema>;
export type CredentialsInput = z.infer<typeof credentialsSchema>;
export type PreferencesInput = z.infer<typeof preferencesSchema>;
export type FullInterpreterProfileInput = z.infer<typeof fullInterpreterProfileSchema>;