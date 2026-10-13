/**
 * Everything the drafts can't know, kept in one place.
 *
 * Each value appears on the page exactly as written, highlighted for as long as it is still a
 * bracketed placeholder. To fill one in, replace its value here and every document picks it up.
 * The highlight goes away by itself once the value no longer looks like `[...]`.
 *
 * Nothing here may be guessed. Certifications, addresses, emails, prices and legal terms come from
 * the owner or from counsel.
 */
export const PLACEHOLDERS = {
  companyName: "[Company legal name]",
  registeredAddress: "[Registered address]",
  contactEmail: "[Contact email]",
  governingLaw: "[Governing law / jurisdiction]",
  effectiveDate: "[Effective date]",
  /** Where Customer Data is stored with AWS. The code and config point at ap-south-1 (Mumbai). */
  hostingRegion: "[Hosting region]",
  /** For example, standard contractual clauses. That choice belongs to counsel. */
  transferMechanism: "[Transfer mechanism]",
  subprocessorLocations: "[Processing location of each sub-processor]",
  dataProtectionLaws: "[Applicable data protection laws]",
  dataProtectionContact: "[Data protection officer or representative, if appointed]",
  minimumAge: "[Minimum age]",
  /** Notice before changes to the Terms, before fees start, and before the beta ends. */
  changeNotice: "[Notice period for changes]",
  subprocessorNotice: "[Notice period for new sub-processors]",
  breachDeadline: "[Breach notification deadline]",
  liabilityCap: "[Liability cap]",
  /** Staff access, confidentiality, training, incident response. None of it can be verified from code. */
  organizationalMeasures: "[Organizational security measures]",
} as const;

export type PlaceholderKey = keyof typeof PLACEHOLDERS;

/** A value still in its `[...]` placeholder form, meaning nobody has filled it in yet. */
export function isPlaceholder(value: string): boolean {
  return value.startsWith("[") && value.endsWith("]");
}
