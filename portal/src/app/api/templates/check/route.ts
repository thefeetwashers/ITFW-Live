// POST /api/templates/check — USCIS template FIELD-CHECK.
// Accepts a USCIS PDF template (multipart FormData: `file`, `formCode`)
// and lists every AcroForm field name the template ACTUALLY contains,
// compared against src/lib/uscisFieldMappings.ts.
//
// This route does NOT fill anything, does NOT store the PDF, and does
// NOT change any mapping. Mappings are updated from the CHECK results
// only — never from guessed names. A mapping counts as matched only
// when its exact AcroForm field name appears in the uploaded PDF for
// that form edition.
//
// Requires pdf-lib (already in package.json). No keys, no live services.
import { NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import {
  SUPPORTED_FORMS,
  mappingsForForm,
} from "@/lib/uscisFieldMappings";

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected a multipart form upload with a PDF file." },
      { status: 400 }
    );
  }

  const formCode = String(form.get("formCode") ?? "").trim();
  const file = form.get("file");

  if (!formCode) {
    return NextResponse.json({ error: "formCode is required." }, { status: 400 });
  }
  if (!SUPPORTED_FORMS.some((f) => f.formCode === formCode)) {
    return NextResponse.json(
      {
        error: `Unknown form code "${formCode}".`,
        supportedForms: SUPPORTED_FORMS.map((f) => f.formCode),
      },
      { status: 400 }
    );
  }
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "No PDF file was uploaded (field name: file)." },
      { status: 400 }
    );
  }
  if (file.type && file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json(
      { error: "Uploaded file is not a PDF." },
      { status: 400 }
    );
  }

  let templateFieldNames: string[];
  try {
    const bytes = await file.arrayBuffer();
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    templateFieldNames = doc.getForm().getFields().map((f) => f.getName());
  } catch (err) {
    return NextResponse.json(
      {
        error: "Could not read this PDF as a form. It may not be a USCIS AcroForm template, or the file is damaged.",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 422 }
    );
  }

  const mappings = mappingsForForm(formCode);
  const templateSet = new Set(templateFieldNames);
  const matched = mappings.filter((m) => templateSet.has(m.acroFormFieldName));
  const mappingNames = new Set(mappings.map((m) => m.acroFormFieldName));
  const unmatchedTemplateFields = templateFieldNames.filter((n) => !mappingNames.has(n));
  const unverifiedMappings = mappings.filter((m) => !templateSet.has(m.acroFormFieldName));

  return NextResponse.json({
    formCode,
    fileName: file.name,
    templateFieldCount: templateFieldNames.length,
    templateFieldNames,
    mappingCount: mappings.length,
    matchedCount: matched.length,
    matched: matched.map((m) => ({
      questionKey: m.questionKey,
      fieldLabel: m.fieldLabel,
      acroFormFieldName: m.acroFormFieldName,
    })),
    // Fields the real PDF has that no mapping covers — these need a
    // mapping written from THIS list, never from a guess.
    unmatchedTemplateFields,
    // Mappings whose guessed name was NOT found on this PDF — still
    // unverified; do not use them to fill this edition.
    unverifiedMappings: unverifiedMappings.map((m) => ({
      questionKey: m.questionKey,
      fieldLabel: m.fieldLabel,
      acroFormFieldName: m.acroFormFieldName,
      verificationNote: m.verificationNote,
    })),
    note:
      "Matched means the mapping's exact AcroForm field name appears on this uploaded PDF. " +
      "Unverified mappings were NOT found on this PDF and must not be used to fill this edition. " +
      "Update src/lib/uscisFieldMappings.ts from these results only.",
  });
}
