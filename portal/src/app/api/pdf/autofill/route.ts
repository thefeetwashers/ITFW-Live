import { NextResponse } from "next/server";

// PDF Auto-Fill API — SKELETON ONLY. NOT live.
// Maps client intake answers (questionnaire_responses, migration 0005;
// field mappings in lib/questionnaire.ts) onto official USCIS PDF
// forms (I-130 / I-485 first).
// REQUIREMENTS NOT YET MET:
//  * pdf-lib is NOT installed in this repo yet (add "pdf-lib" to
//    package.json and run npm install before implementing).
//  * The official USCIS PDF templates must be supplied / downloaded
//    from uscis.gov and are NOT included in this repo — do not bundle
//    a fake form and call it official.
//  * Auto-filled PDFs are DRAFTS for provider + client review before
//    filing. They are NEVER auto-filed.
// Until those exist this route returns 501 and fills nothing.
export async function POST() {
  return NextResponse.json(
    {
      error:
        "PDF auto-fill not implemented yet — pdf-lib and the official USCIS PDF templates (I-130 / I-485, from uscis.gov) are required. Auto-filled PDFs are drafts for review, never auto-filed.",
      mappingSource: "src/lib/questionnaire.ts FIELD_MAPPINGS",
      formsPlanned: ["I-130", "I-485"],
    },
    { status: 501 }
  );
}
