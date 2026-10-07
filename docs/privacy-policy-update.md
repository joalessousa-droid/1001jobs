# Privacy notice update — 2026-10-07

## Change and impact
Filled the supplied controller identity, CNPJ, separate privacy/DPO emails, 180-day account-closure deletion/anonymization deadline and São Luís/MA jurisdiction. Preserved statutory retention exceptions and consumer jurisdiction protections. Updated the displayed revision date while retaining document version 2.0.

Added full English and Spanish translations with the same 57 sections (introduction, contents and 55 numbered sections), block types, subheadings and line counts. The existing language selector selects the entire notice through i18next resources, including the contents label; unsupported languages fall back to Portuguese. Page layout remains unchanged except for long-text wrapping and the existing design-system button.

## Dependencies, security and regression scope
Reuses existing i18next and privacy page. No backend, database, permission, deletion job, financial, KYC, tracking or task-flow changes. This updates policy text only; it does not implement or verify operational deletion within 180 days. No external translation requests happen at runtime.

## Outstanding factual details
No postal box has been contracted or registered by this change. A real box number, full mailing address, DPO name/company and dedicated privacy portal remain unprovided and are explicitly marked pending/not supplied in every language. DPO identity needs completion for legal review. These are not invented or silently omitted.

## Verification
Regression tests cover complete structural equivalence, critical legal details and contact identifiers, no raw placeholders, pending postal address, entire-document language switching, open contents persistence, regional English and Portuguese fallback. All 6 targeted tests passed. Preview build reported OK at 00:57:21 UTC. Playwright opened `/privacidade` and switched PT → EN → ES through the existing language menu without reload: 56 displayed content sections plus the contents section in each language, translated titles/contents, supplied company/email/deadline details, no horizontal overflow at 1280 × 1800 and no page runtime errors. English and Spanish screenshots were visually inspected. No long Portuguese strings remained unchanged in either translation. Legal translation review and delivery/registration of the postal box are not claimed.