// Interview preparation — question banks, guides and video scripts.
//
// HONESTY RULES (founder brief, 2026-11-28):
//   * Every question set is built ONLY from official USCIS guidance and
//     cites its uscis.gov source in the data (URL + what it is based on).
//   * NEVER invent a question and present it as an official USCIS
//     question. Two kinds exist and are labelled on every item:
//       - "official_civics": one of the official USCIS 100 civics
//         questions (2008 test). The bank below is a SAMPLE of 25 of
//         the 100 — the full 100 live on uscis.gov, not here. Study
//         all 100 there; this sample is not the whole test.
//       - "practice": written by the platform, based on the topics
//         USCIS lists for that interview. NOT official USCIS questions.
//         An officer will not necessarily ask these exact questions.
//   * No approval guarantee anywhere: Immigration with NIPTEI is not
//     USCIS and cannot promise an outcome. Delay / denial reasons are
//     phrased honestly.
//   * VIDEO: no videos are generated here. The scripts in this file are
//     storyboards for production ("Video script — not a finished
//     video"). Founder video standard where relevant: 60 seconds,
//     9:16 vertical, website name big and readable top and bottom.
//
// This file is DATA ONLY — no Supabase, no Stripe, no sending. It is
// imported ONLY by the server route /api/interview-prep, which serves
// it after a server-side paid-access check (src/lib/paywall.ts). The
// interview-prep page never imports this file directly, so unpaid
// visitors cannot read the banks from the page bundle.

export interface InterviewSource {
  /** Human label, e.g. "USCIS — Study for the Test". */
  label: string;
  /** Official source URL. */
  url: string;
  /** What this item is based on, in plain English. */
  basedOn: string;
}

export type InterviewQuestionKind = "official_civics" | "practice";

export interface InterviewQuestion {
  id: string;
  bankId: string;
  kind: InterviewQuestionKind;
  question: string;
  /** Official answer (civics only). Practice questions have no fixed
   *  answer — the officer wants YOUR true answer, consistent with
   *  your application. */
  answer?: string;
  answerNote?: string;
  source: InterviewSource;
}

export interface InterviewBank {
  id: "n400-civics" | "n400-personal" | "i485" | "consular";
  title: string;
  interviewType: "N-400 naturalization" | "I-485 adjustment of status" | "Consular (immigrant visa)";
  intro: string;
  source: InterviewSource;
  questions: InterviewQuestion[];
}

export const NO_GUARANTEE_NOTICE =
  "Immigration with NIPTEI is not USCIS and cannot promise an outcome. " +
  "Preparing well helps you answer clearly and completely — it does not " +
  "guarantee approval. Only USCIS (or the consulate, for a visa abroad) " +
  "decides your case.";

export const CIVICS_SOURCE: InterviewSource = {
  label: "USCIS — Study for the Test (official 100 civics questions)",
  url: "https://www.uscis.gov/citizenship/find-study-materials-and-resources/study-for-the-test",
  basedOn:
    "Official USCIS 100 civics questions list (2008 test). Each item below is one of the 100, worded as USCIS words it. This bank is a sample of 25 of the 100 — study all 100 on uscis.gov, not only this sample.",
};

export const N400_INTERVIEW_SOURCE: InterviewSource = {
  label: "USCIS — The Naturalization Interview and Test",
  url: "https://www.uscis.gov/citizenship/learn-about-citizenship/the-naturalization-interview-and-test",
  basedOn:
    "Topics USCIS lists for the naturalization interview (application review, English test, civics test). Practice questions written by the platform from those topics — NOT official USCIS questions.",
};

export const I485_SOURCE: InterviewSource = {
  label: "USCIS — Adjustment of Status",
  url: "https://www.uscis.gov/green-card/green-card-processes-and-procedures/adjustment-of-status",
  basedOn:
    "Topics USCIS lists for adjustment of status and the adjustment interview (eligibility, admissibility, supporting evidence). Practice questions written by the platform from those topics — NOT official USCIS questions.",
};

export const CONSULAR_SOURCE: InterviewSource = {
  label: "USCIS — Consular Processing",
  url: "https://www.uscis.gov/green-card/green-card-processes-and-procedures/consular-processing",
  basedOn:
    "Consular processing steps USCIS describes (NVC, DS-260, medical exam, embassy interview) and the interview topics the U.S. Department of State lists for the immigrant-visa interview. Practice questions written by the platform from those topics — NOT official USCIS or State Department questions.",
};

// ---------------------------------------------------------------------------
// N-400 civics — SAMPLE of 25 of the official 100
// ---------------------------------------------------------------------------

const CIVICS_QUESTIONS: InterviewQuestion[] = [
  { id: "civ-01", bankId: "n400-civics", kind: "official_civics", question: "What is the supreme law of the land?", answer: "The Constitution.", source: CIVICS_SOURCE },
  { id: "civ-02", bankId: "n400-civics", kind: "official_civics", question: "What does the Constitution do?", answer: "Sets up the government; defines the government; protects basic rights of Americans. (Any one of these is a correct answer.)", source: CIVICS_SOURCE },
  { id: "civ-03", bankId: "n400-civics", kind: "official_civics", question: "The idea of self-government is in the first three words of the Constitution. What are these words?", answer: "We the People.", source: CIVICS_SOURCE },
  { id: "civ-04", bankId: "n400-civics", kind: "official_civics", question: "What do we call the first ten amendments to the Constitution?", answer: "The Bill of Rights.", source: CIVICS_SOURCE },
  { id: "civ-05", bankId: "n400-civics", kind: "official_civics", question: "What is one right or freedom from the First Amendment?", answer: "Speech; religion; assembly; press; petition the government. (Any one of these is a correct answer.)", source: CIVICS_SOURCE },
  { id: "civ-06", bankId: "n400-civics", kind: "official_civics", question: "How many amendments does the Constitution have?", answer: "Twenty-seven (27).", source: CIVICS_SOURCE },
  { id: "civ-07", bankId: "n400-civics", kind: "official_civics", question: "What did the Declaration of Independence do?", answer: "Announced our independence (from Great Britain); declared our independence (from Great Britain); said that the United States is free (from Great Britain).", source: CIVICS_SOURCE },
  { id: "civ-08", bankId: "n400-civics", kind: "official_civics", question: "What are two rights in the Declaration of Independence?", answer: "Life; liberty; pursuit of happiness. (Any two.)", source: CIVICS_SOURCE },
  { id: "civ-09", bankId: "n400-civics", kind: "official_civics", question: "What is freedom of religion?", answer: "You can practice any religion, or not practice a religion.", source: CIVICS_SOURCE },
  { id: "civ-10", bankId: "n400-civics", kind: "official_civics", question: "What is the economic system in the United States?", answer: "Capitalist economy; free market economy.", source: CIVICS_SOURCE },
  { id: "civ-11", bankId: "n400-civics", kind: "official_civics", question: "What is the “rule of law”?", answer: "Everyone must follow the law; leaders must obey the law; government must obey the law; no one is above the law.", source: CIVICS_SOURCE },
  { id: "civ-12", bankId: "n400-civics", kind: "official_civics", question: "Name one branch or part of the government.", answer: "Congress (legislative); the President (executive); the courts (judicial). (Any one.)", source: CIVICS_SOURCE },
  { id: "civ-13", bankId: "n400-civics", kind: "official_civics", question: "What stops one branch of government from becoming too powerful?", answer: "Checks and balances; separation of powers.", source: CIVICS_SOURCE },
  { id: "civ-14", bankId: "n400-civics", kind: "official_civics", question: "Who is in charge of the executive branch?", answer: "The President.", source: CIVICS_SOURCE },
  { id: "civ-15", bankId: "n400-civics", kind: "official_civics", question: "Who makes federal laws?", answer: "Congress; the Senate and the House (of Representatives); the (U.S. or national) legislature.", source: CIVICS_SOURCE },
  { id: "civ-16", bankId: "n400-civics", kind: "official_civics", question: "What are the two parts of the U.S. Congress?", answer: "The Senate and the House (of Representatives).", source: CIVICS_SOURCE },
  { id: "civ-17", bankId: "n400-civics", kind: "official_civics", question: "How many U.S. Senators are there?", answer: "One hundred (100).", source: CIVICS_SOURCE },
  { id: "civ-18", bankId: "n400-civics", kind: "official_civics", question: "We elect a U.S. Senator for how many years?", answer: "Six (6).", source: CIVICS_SOURCE },
  { id: "civ-19", bankId: "n400-civics", kind: "official_civics", question: "Who does a U.S. Senator represent?", answer: "All people of the state.", source: CIVICS_SOURCE },
  { id: "civ-20", bankId: "n400-civics", kind: "official_civics", question: "Why do some states have more Representatives than other states?", answer: "Because of the state’s population; because they have more people; because some states have more people.", source: CIVICS_SOURCE },
  { id: "civ-21", bankId: "n400-civics", kind: "official_civics", question: "We elect a President for how many years?", answer: "Four (4).", source: CIVICS_SOURCE },
  { id: "civ-22", bankId: "n400-civics", kind: "official_civics", question: "In what month do we vote for President?", answer: "November.", source: CIVICS_SOURCE },
  { id: "civ-23", bankId: "n400-civics", kind: "official_civics", question: "What does the judicial branch do?", answer: "Reviews laws; explains laws; resolves disputes (disagreements); decides if a law goes against the Constitution.", source: CIVICS_SOURCE },
  { id: "civ-24", bankId: "n400-civics", kind: "official_civics", question: "What is the highest court in the United States?", answer: "The Supreme Court.", source: CIVICS_SOURCE },
  { id: "civ-25", bankId: "n400-civics", kind: "official_civics", question: "How many justices are on the Supreme Court?", answer: "Nine (9).", source: CIVICS_SOURCE },
];

// ---------------------------------------------------------------------------
// N-400 personal interview — PRACTICE questions (platform-written)
// ---------------------------------------------------------------------------

function practice(
  id: string,
  bankId: string,
  question: string,
  source: InterviewSource,
  answerNote?: string
): InterviewQuestion {
  return { id, bankId, kind: "practice", question, source, answerNote };
}

const N400_PERSONAL_QUESTIONS: InterviewQuestion[] = [
  practice("n400p-01", "n400-personal", "Have you moved since you filed your N-400? What is your current address, and what addresses have you lived at in the last 5 years?", N400_INTERVIEW_SOURCE, "Your answer must match the address history on your application. Bring proof of address if you moved."),
  practice("n400p-02", "n400-personal", "Have you travelled outside the United States since you became a permanent resident? When did you leave, when did you return, and where did you go?", N400_INTERVIEW_SOURCE, "Long trips matter for continuous residence. Answer from your travel records, not from memory alone."),
  practice("n400p-03", "n400-personal", "Where do you work now, and where have you worked in the last 5 years?", N400_INTERVIEW_SOURCE, "Your answer must match the employment history on your application."),
  practice("n400p-04", "n400-personal", "Have you filed your taxes every year since you became a permanent resident? Did you file as a resident?", N400_INTERVIEW_SOURCE, "Bring your tax returns or IRS transcripts if the officer asks. Unfiled taxes can delay a case — get help before the interview if you missed a year."),
  practice("n400p-05", "n400-personal", "Are you married now? Have you been married before, and are you divorced or widowed from any earlier marriage?", N400_INTERVIEW_SOURCE, "Bring marriage and divorce certificates for every marriage, including earlier ones."),
  practice("n400p-06", "n400-personal", "Do you have children? Where do they live, and do you support them?", N400_INTERVIEW_SOURCE, "List every child, including children who live abroad or with the other parent."),
  practice("n400p-07", "n400-personal", "Have you ever been arrested, charged with a crime, or been in court for any reason — including a traffic case that went to court?", N400_INTERVIEW_SOURCE, "Answer truthfully. If anything in your past is unclear, talk to an attorney BEFORE the interview — do not guess at the interview."),
  practice("n400p-08", "n400-personal", "Have you ever claimed to be a U.S. citizen, or voted in a U.S. election, before becoming a citizen?", N400_INTERVIEW_SOURCE, "A wrong answer here can end a case. If you are unsure, talk to an attorney before the interview."),
  practice("n400p-09", "n400-personal", "If you are a man who lived in the United States between the ages of 18 and 26, did you register for Selective Service?", N400_INTERVIEW_SOURCE, "Bring your Selective Service registration letter or proof you were exempt, if the officer asks."),
  practice("n400p-10", "n400-personal", "Do you owe any taxes, child support, or other debts to the government?", N400_INTERVIEW_SOURCE, "Bring proof of payment or a payment plan if you owe anything."),
  practice("n400p-11", "n400-personal", "Are you willing to take the Oath of Allegiance to the United States?", N400_INTERVIEW_SOURCE, "The officer asks this at the end of the interview. If you need a modified oath for religious reasons, say so and bring the request in writing."),
  practice("n400p-12", "n400-personal", "Is there anything on your application that has changed since you filed it, or anything you want to correct?", N400_INTERVIEW_SOURCE, "Tell the officer about changes (address, job, marriage, trips, arrests) at the start of the interview — do not wait to be asked."),
];

// ---------------------------------------------------------------------------
// I-485 adjustment interview — PRACTICE questions (platform-written)
// ---------------------------------------------------------------------------

const I485_QUESTIONS: InterviewQuestion[] = [
  practice("i485-01", "i485", "How did you enter the United States — when, where, and on what visa or status?", I485_SOURCE, "Your answer must match your I-94 and your entry records. Bring your passport with the entry stamp."),
  practice("i485-02", "i485", "Have you stayed in the United States without interruption since you arrived? Have you ever left and come back?", I485_SOURCE, "Trips and any time out of status matter. Answer from your records."),
  practice("i485-03", "i485", "Where have you lived since you arrived, and where do you live now?", I485_SOURCE, "Your answer must match the address history on your application."),
  practice("i485-04", "i485", "Where do you work now, and how do you support yourself?", I485_SOURCE, "Bring pay stubs or an employment letter if the officer asks."),
  practice("i485-05", "i485", "Who is sponsoring you, and how are they related to you? What does your sponsor do for work?", I485_SOURCE, "The officer checks the I-864 Affidavit of Support. Bring your sponsor's tax returns or IRS transcripts."),
  practice("i485-06", "i485", "Have you ever been arrested, detained, or charged with a crime — in the United States or in any other country?", I485_SOURCE, "Answer truthfully. If anything is unclear, talk to an attorney BEFORE the interview."),
  practice("i485-07", "i485", "Have you ever used a different name, or had a different immigration status than the one on your application?", I485_SOURCE, "List every name you have used, including maiden names and names on foreign documents."),
  practice("i485-08", "i485", "Have you completed your medical exam (Form I-693)? Do you have the sealed envelope from the civil surgeon?", I485_SOURCE, "Do not open the sealed I-693 envelope. Bring it sealed to the interview."),
  // Marriage-based adjustment — the officer tests whether the marriage is real.
  practice("i485-09", "i485", "When and where did you first meet your spouse, and when and where did you get married?", I485_SOURCE, "Both spouses are usually asked the same questions separately. Answer truthfully — do not rehearse a story together."),
  practice("i485-10", "i485", "Where do you and your spouse live together, and who else lives with you?", I485_SOURCE, "Bring joint proof: lease or mortgage, joint bank statements, joint bills, joint tax returns."),
  practice("i485-11", "i485", "What does your spouse do every day — their job, their schedule — and what do you do together on a typical weekend?", I485_SOURCE, "The officer is checking that you share a real life together, not that you memorised answers."),
  practice("i485-12", "i485", "Have you met each other's families? When did you last see them, and where do they live?", I485_SOURCE, "Photos with family and messages help show a real marriage — bring originals, not only phone screenshots."),
  practice("i485-13", "i485", "What joint documents can you show — bank statements, lease, photos, messages — that show your life together?", I485_SOURCE, "Bring originals and copies. Organise them by date so the officer can follow them."),
  practice("i485-14", "i485", "What plans do you and your spouse have together for the next year?", I485_SOURCE, "Answer in your own words. There is no single correct answer — the officer is listening for a real shared life."),
];

// ---------------------------------------------------------------------------
// Consular (immigrant visa) interview — PRACTICE questions
// ---------------------------------------------------------------------------

const CONSULAR_QUESTIONS: InterviewQuestion[] = [
  practice("con-01", "consular", "Who petitioned for you, and how are they related to you?", CONSULAR_SOURCE, "Your answer must match the approved petition (I-130, I-129F, or I-140) and your DS-260."),
  practice("con-02", "consular", "Where does your petitioner live in the United States, and what do they do for work?", CONSULAR_SOURCE, "The officer checks the I-864 Affidavit of Support. Bring the sponsor's tax documents."),
  practice("con-03", "consular", "Have you ever travelled to the United States before? When, on what visa, and did you leave on time?", CONSULAR_SOURCE, "Any overstay or visa problem must be answered truthfully — the officer already has your travel record."),
  practice("con-04", "consular", "Have you ever applied for a U.S. visa before and been refused? When and why?", CONSULAR_SOURCE, "Bring the refusal letter if you still have it."),
  practice("con-05", "consular", "Where will you live in the United States, and who will you live with?", CONSULAR_SOURCE, "Give the real address and the real person — the officer may check it."),
  practice("con-06", "consular", "What work do you plan to do in the United States?", CONSULAR_SOURCE, "Answer in your own words. For a family case, there is no job offer to prove — the officer is checking your intent."),
  practice("con-07", "consular", "Have you ever been arrested or charged with a crime, in any country?", CONSULAR_SOURCE, "Bring the police certificate and any court records. If anything is unclear, talk to an attorney BEFORE the interview."),
  practice("con-08", "consular", "Have you completed your medical exam with the panel physician? Do you have your vaccination records?", CONSULAR_SOURCE, "The medical results usually go straight to the embassy — bring your vaccination records and the exam receipt."),
  practice("con-09", "consular", "Are you married? Have you been married before? Do you have children, and are they travelling with you?", CONSULAR_SOURCE, "Bring original marriage, divorce and birth certificates, plus certified translations if they are not in English."),
  practice("con-10", "consular", "Do you have family in the United States besides your petitioner? Where do they live?", CONSULAR_SOURCE, "List every close relative in the United States."),
  practice("con-11", "consular", "For a fiancé(e) (K-1) case: when did you last meet your fiancé(e) in person, and when do you plan to marry after you arrive?", CONSULAR_SOURCE, "A K-1 fiancé(e) must marry within 90 days of entering the United States. Bring proof of your meetings and your intent to marry."),
  practice("con-12", "consular", "Is there anything on your DS-260 that has changed since you submitted it?", CONSULAR_SOURCE, "Tell the officer about changes (address, job, marriage, children) at the start of the interview."),
];

export const INTERVIEW_BANKS: InterviewBank[] = [
  {
    id: "n400-civics",
    title: "N-400 Civics Test — official USCIS questions (sample of 25 of 100)",
    interviewType: "N-400 naturalization",
    intro:
      "The civics test asks up to 10 questions from the official list of 100. You must answer 6 correctly to pass. " +
      "These 25 are real official questions with their official answers. Study ALL 100 on uscis.gov — this sample is not the whole test, " +
      "and the officer will ask questions from the full list, not only from this page.",
    source: CIVICS_SOURCE,
    questions: CIVICS_QUESTIONS,
  },
  {
    id: "n400-personal",
    title: "N-400 Personal Interview — practice questions",
    interviewType: "N-400 naturalization",
    intro:
      "Before the English and civics tests, the officer reviews your N-400 with you, question by question. " +
      "These are PRACTICE questions written by the platform from the topics USCIS lists for the interview. " +
      "They are NOT official USCIS questions, and the officer will ask about YOUR application, not this list. " +
      "The right answer is always your true answer, consistent with your application and your documents.",
    source: N400_INTERVIEW_SOURCE,
    questions: N400_PERSONAL_QUESTIONS,
  },
  {
    id: "i485",
    title: "I-485 Adjustment Interview — practice questions",
    interviewType: "I-485 adjustment of status",
    intro:
      "The officer checks your eligibility, your admissibility, and — for a marriage case — whether the marriage is real. " +
      "These are PRACTICE questions written by the platform from the topics USCIS lists for adjustment. " +
      "They are NOT official USCIS questions. Answer truthfully and in your own words; do not memorise a story.",
    source: I485_SOURCE,
    questions: I485_QUESTIONS,
  },
  {
    id: "consular",
    title: "Consular (Immigrant Visa) Interview — practice questions",
    interviewType: "Consular (immigrant visa)",
    intro:
      "At the embassy or consulate, the officer checks your petition, your DS-260, your civil documents, your medical exam, " +
      "and your sponsor's support. These are PRACTICE questions written by the platform from the topics USCIS and the " +
      "Department of State list for the interview. They are NOT official questions. Answer truthfully — the officer already " +
      "has your file in front of them.",
    source: CONSULAR_SOURCE,
    questions: CONSULAR_QUESTIONS,
  },
];

// ---------------------------------------------------------------------------
// What to bring, how to conduct yourself, what the officer looks for
// ---------------------------------------------------------------------------

export interface WhatToBringItem {
  item: string;
  why: string;
}

export interface WhatToBringGuide {
  interviewType: InterviewBank["interviewType"];
  source: InterviewSource;
  /** Always check this first — it lists exactly what YOUR interview needs. */
  checkFirst: string;
  items: WhatToBringItem[];
}

export const WHAT_TO_BRING: WhatToBringGuide[] = [
  {
    interviewType: "N-400 naturalization",
    source: N400_INTERVIEW_SOURCE,
    checkFirst:
      "Your appointment notice lists exactly what to bring to YOUR interview. Read it first — it overrides this general list.",
    items: [
      { item: "Appointment notice (Form N-400 interview notice)", why: "It is your entry ticket to the interview and lists what the officer expects." },
      { item: "Green card (front and back) and passport(s), including expired ones", why: "Proof of identity and of your travel history." },
      { item: "State ID or driver's licence", why: "Proof of where you live now." },
      { item: "Tax returns or IRS transcripts for the last 5 years (3 years if married to a U.S. citizen)", why: "The officer may check that you filed taxes as a resident." },
      { item: "Travel records — every trip abroad since you became a resident, with dates", why: "Trips matter for continuous residence. Bring the dates, not guesses." },
      { item: "Marriage / divorce certificates, if any apply", why: "The officer reviews your marital history on the N-400." },
      { item: "Selective Service registration letter (men who lived in the U.S. between 18 and 26), if it applies", why: "The officer may ask for proof of registration." },
      { item: "Court records for any arrest, charge, or court case, if any apply", why: "Bring certified dispositions — the officer will ask about anything in your record." },
    ],
  },
  {
    interviewType: "I-485 adjustment of status",
    source: I485_SOURCE,
    checkFirst:
      "Your appointment notice lists exactly what to bring to YOUR interview. Read it first — it overrides this general list.",
    items: [
      { item: "Appointment notice and a government-issued photo ID", why: "Entry to the interview and proof of who you are." },
      { item: "Passport(s), including expired ones, with entry stamps", why: "Proof of how and when you entered the United States." },
      { item: "Birth certificate (original) + certified English translation if it is not in English", why: "Proof of identity and nationality." },
      { item: "Marriage certificate (original) + certified translation, and divorce certificates for earlier marriages", why: "Proof of the marriage the case is based on." },
      { item: "Sealed Form I-693 medical exam envelope from the civil surgeon — DO NOT OPEN IT", why: "An opened envelope is not accepted. Bring it sealed." },
      { item: "Form I-864 Affidavit of Support + sponsor's tax returns / IRS transcripts", why: "Proof your sponsor can support you at 125% of the poverty guidelines." },
      { item: "Joint evidence (marriage cases): lease or mortgage, joint bank statements, joint bills, joint tax returns, photos", why: "Proof the marriage is real — originals and copies, organised by date." },
      { item: "Employment letter or recent pay stubs", why: "Proof of how you support yourself now." },
      { item: "Court records for any arrest or charge, if any apply", why: "Bring certified dispositions — do not hide anything in your record." },
    ],
  },
  {
    interviewType: "Consular (immigrant visa)",
    source: CONSULAR_SOURCE,
    checkFirst:
      "Your embassy appointment letter and the NVC / embassy instructions list exactly what to bring. Read them first — they override this general list, and each embassy has its own medical and document steps.",
    items: [
      { item: "Appointment letter from the embassy / NVC and DS-260 confirmation page", why: "Entry to the interview." },
      { item: "Passport valid for at least 6 months beyond your planned travel", why: "The visa goes in this passport. An expired or nearly-expired passport delays the visa." },
      { item: "Original civil documents: birth, marriage, divorce certificates + certified English translations", why: "The officer checks originals against what you uploaded to CEAC." },
      { item: "Police certificates from every country where you lived for 6 months or more since age 16", why: "Required for the immigrant visa. Get them early — some take weeks." },
      { item: "Medical exam results from the embassy's panel physician + vaccination records", why: "The exam is done before the interview, with a doctor the embassy names — not your own doctor." },
      { item: "Form I-864 Affidavit of Support + sponsor's tax returns / IRS transcripts", why: "Proof your U.S. sponsor can support you." },
      { item: "Two passport-style photos (2x2) that meet the embassy's photo rules", why: "The embassy takes a photo at the interview too — bring spares that meet the rules." },
      { item: "Proof of relationship to the petitioner (photos, messages, visit records)", why: "For family cases, proof the relationship is real." },
    ],
  },
];

export const CONDUCT_GUIDE: { heading: string; points: string[] } = {
  heading: "How to conduct yourself at the interview",
  points: [
    "Arrive early — at least 30 minutes before your appointment time. Late arrival can mean rescheduling, which adds months.",
    "Dress neatly, as you would for a formal appointment. You do not need a suit, but clean, tidy clothes show respect for the process.",
    "Answer only the question asked, in short, clear sentences. Do not volunteer unrelated information and do not guess — if you do not know, say “I do not know.”",
    "Tell the truth, always. A lie or a hidden fact found later can end a case and can bar future applications. If you are unsure about a fact in your past, talk to an attorney BEFORE the interview.",
    "Listen to the whole question before you answer. If you do not understand, ask the officer to repeat it or say it more slowly. That is allowed.",
    "Bring originals AND copies of every document. Hand over the copy first; keep the original in your hand unless the officer asks for it.",
    "Switch your phone off before you go in. Do not record the interview unless the officer tells you that you may.",
    "For a marriage interview, answer in your own words. Officers can tell when two people rehearsed the same story — a real shared life sounds different from a script.",
    "If you need an interpreter, check your appointment notice first. Do not assume one will be provided — for some interviews you must bring your own qualified interpreter, and a family member is often not allowed to interpret.",
    "If the officer asks for a document you did not bring, say so plainly and ask what to send and by when. Do not invent the document on the spot.",
  ],
};

export const WHAT_OFFICER_LOOKS_FOR: { heading: string; points: string[] } = {
  heading: "What immigration is looking for",
  points: [
    "Identity: that you are the person on the application, with documents that prove it.",
    "Eligibility: that you meet the legal requirements for the benefit you asked for (residence time for N-400, a qualifying relationship for I-130/I-485, a valid petition for a visa).",
    "Consistency: that what you say matches your application, your documents, and your earlier statements. Small honest mistakes can be corrected; contradictions are a problem.",
    "Good moral character (N-400): taxes filed, debts and support paid, no serious criminal history, and truthful answers.",
    "A real marriage (marriage-based I-485 and consular cases): a shared home, shared money, shared plans, and a life lived together — shown with documents, not only with words.",
    "Admissibility: that nothing in your health, criminal, or immigration history bars the benefit, and that your sponsor's support is enough (I-864).",
    "English and civics (N-400): that you can read, write, and speak basic English and answer the civics questions — unless you qualify for an exemption, which the officer will check.",
  ],
};

export const DELAY_DENIAL_REASONS: { heading: string; intro: string; reasons: { reason: string; whatItMeans: string; whatToDo: string }[] } = {
  heading: "Common reasons for delay or denial — stated honestly",
  intro:
    "These are the common reasons cases are delayed, asked for more evidence (RFE), or denied. None of them is a prediction about YOUR case, " +
    "and this list cannot tell you whether your case will be approved. If any of these apply to you, talk to an attorney before you file or before your interview.",
  reasons: [
    { reason: "Missing or incomplete documents", whatItMeans: "The officer cannot decide without the evidence the law requires.", whatToDo: "Use the document checklist for your form and bring originals plus copies. If a document is missing, say so and ask what to send and by when." },
    { reason: "Answers that do not match the application", whatItMeans: "The officer compares your testimony with your forms and earlier statements.", whatToDo: "Read your own application before the interview so you know what it says. Correct mistakes at the start, before you are asked." },
    { reason: "Missed appointment or missed deadline", whatItMeans: "Missing an interview or an RFE deadline can lead to denial or to the case being closed.", whatToDo: "Keep your address updated with USCIS (Form AR-11) and with NVC, and open every letter the day it arrives." },
    { reason: "Criminal history or prior immigration violations", whatItMeans: "Some arrests, convictions, overstays, or unlawful entries make a person inadmissible.", whatToDo: "Do not hide it and do not guess. Bring certified court records and talk to an attorney before the interview." },
    { reason: "Sponsor income too low (I-864)", whatItMeans: "The sponsor must show income at 125% of the poverty guidelines, or a joint sponsor is needed.", whatToDo: "Check the sponsor's tax returns before filing. A joint sponsor's I-864 must be complete and signed." },
    { reason: "Medical exam problems (I-693 / panel physician)", whatItMeans: "A missing vaccination, an unsealed envelope, or an expired exam stalls the case.", whatToDo: "Use only the civil surgeon / panel physician the government names, keep the envelope sealed, and check the exam has not expired." },
    { reason: "Marriage not believed to be real", whatItMeans: "For marriage cases, weak or inconsistent joint evidence can lead to denial.", whatToDo: "Bring real joint evidence organised by date. Do not create documents for the interview — officers check dates and sources." },
    { reason: "Security or background checks still pending", whatItMeans: "Some cases wait months while background checks run. This is a delay, not a denial.", whatToDo: "There is nothing to file to speed this up. Keep your address current and answer any letter quickly." },
    { reason: "Visa not yet available (consular cases)", whatItMeans: "A visa number must be current in the Visa Bulletin before the embassy can issue the visa.", whatToDo: "Check the Visa Bulletin monthly. An interview can happen before a visa is available, but the visa cannot be issued until your date is current." },
  ],
};

// ---------------------------------------------------------------------------
// Video scripts — storyboards for production, NOT finished videos.
// Founder standard: 60 seconds, 9:16 vertical, website name big and
// readable top and bottom throughout.
// ---------------------------------------------------------------------------

export interface VideoScriptScene {
  scene: number;
  /** Seconds within the 60-second video, e.g. "0:00–0:12". */
  time: string;
  visual: string;
  onScreenText: string;
  narration: string;
}

export interface VideoScript {
  id: string;
  title: string;
  interviewType: InterviewBank["interviewType"];
  lengthSeconds: 60;
  format: string;
  status: "Video script — not a finished video";
  purpose: string;
  scenes: VideoScriptScene[];
}

export const VIDEO_SCRIPTS: VideoScript[] = [
  {
    id: "vid-n400-expect",
    title: "Your N-400 Interview: What to Expect",
    interviewType: "N-400 naturalization",
    lengthSeconds: 60,
    format: "9:16 vertical — website name big and readable, top and bottom, in every scene",
    status: "Video script — not a finished video",
    purpose: "A client about to take the naturalization interview learns the order of the interview (application review, English test, civics test) and what to bring.",
    scenes: [
      { scene: 1, time: "0:00–0:10", visual: "Client walks into a USCIS office holding a folder. Website name big, top and bottom.", onScreenText: "YOUR N-400 INTERVIEW\nWhat to expect", narration: "Your naturalization interview has three parts: your application, your English test, and your civics test." },
      { scene: 2, time: "0:10–0:22", visual: "Close-up of the folder: green card, passport, appointment notice.", onScreenText: "BRING: green card, passport,\nappointment notice", narration: "Bring your green card, your passport, and your appointment notice. Your notice lists everything else to bring." },
      { scene: 3, time: "0:22–0:36", visual: "Officer asks a question; client answers calmly and clearly.", onScreenText: "ANSWER TRUTHFULLY\nShort, clear answers", narration: "The officer goes through your application with you. Answer truthfully, in short, clear sentences. If you do not understand, ask them to repeat it." },
      { scene: 4, time: "0:36–0:48", visual: "Client reads a sentence aloud, then writes a sentence; civics flashcard appears.", onScreenText: "ENGLISH TEST + CIVICS TEST\n6 of 10 correct to pass", narration: "Then the English test — reading, writing, speaking — and the civics test. Ten questions from the official list of one hundred. Six correct to pass." },
      { scene: 5, time: "0:48–1:00", visual: "Client smiles, holds up the study guide. Website name big, top and bottom.", onScreenText: "STUDY ALL 100 QUESTIONS\nimmigration.niptei.com", narration: "Study all one hundred questions on uscis.gov — and practice with us at immigration.niptei.com." },
    ],
  },
  {
    id: "vid-civics-study",
    title: "Civics Test: How to Study the 100 Questions",
    interviewType: "N-400 naturalization",
    lengthSeconds: 60,
    format: "9:16 vertical — website name big and readable, top and bottom, in every scene",
    status: "Video script — not a finished video",
    purpose: "Teaches the study method: learn the 100 in small groups, test yourself, and learn the answers that depend on where you live.",
    scenes: [
      { scene: 1, time: "0:00–0:10", visual: "Flashcards spread on a table: American government, history, symbols.", onScreenText: "100 CIVICS QUESTIONS\nLearn them in small groups", narration: "One hundred civics questions. Do not try to learn them all in one night. Learn them in small groups." },
      { scene: 2, time: "0:10–0:22", visual: "Three piles labelled Government, History, Symbols.", onScreenText: "GOVERNMENT • HISTORY\nSYMBOLS", narration: "Start with American government, then history, then symbols and holidays. Ten questions a day, every day." },
      { scene: 3, time: "0:22–0:36", visual: "Client covers the answer, says it aloud, then checks.", onScreenText: "SAY IT ALOUD\nThen check yourself", narration: "Cover the answer. Say it aloud. Then check. Saying it aloud is how you remember it at the interview." },
      { scene: 4, time: "0:36–0:48", visual: "Map of the United States; a pin drops on the client's state.", onScreenText: "SOME ANSWERS DEPEND\nON WHERE YOU LIVE", narration: "Some answers depend on where you live — your senator, your representative, your governor. Learn YOUR answers, not someone else's." },
      { scene: 5, time: "0:48–1:00", visual: "Client answers a practice question correctly and smiles.", onScreenText: "PRACTICE EVERY DAY\nimmigration.niptei.com", narration: "Practice every day. Ten questions at the interview, six correct to pass — at immigration.niptei.com." },
    ],
  },
  {
    id: "vid-i485-bring",
    title: "Your I-485 Interview: What to Bring",
    interviewType: "I-485 adjustment of status",
    lengthSeconds: 60,
    format: "9:16 vertical — website name big and readable, top and bottom, in every scene",
    status: "Video script — not a finished video",
    purpose: "A client checks the bag before the adjustment interview: appointment notice, ID, sealed medical envelope, sponsor papers, joint evidence.",
    scenes: [
      { scene: 1, time: "0:00–0:10", visual: "Client packs a bag on a bed the night before the interview.", onScreenText: "YOUR I-485 INTERVIEW\nPack the night before", narration: "Your adjustment interview is tomorrow. Pack tonight — not in the morning." },
      { scene: 2, time: "0:10–0:24", visual: "Items laid out: appointment notice, passport, birth certificate, marriage certificate.", onScreenText: "NOTICE • PASSPORT\nBIRTH + MARRIAGE CERTIFICATES", narration: "Appointment notice. Passport. Birth certificate and marriage certificate — originals, plus copies." },
      { scene: 3, time: "0:24–0:36", visual: "Sealed envelope labelled I-693; a hand stops — do not open it.", onScreenText: "SEALED I-693 ENVELOPE\nDO NOT OPEN IT", narration: "Your medical exam envelope stays sealed. An opened envelope is not accepted." },
      { scene: 4, time: "0:36–0:48", visual: "Sponsor's tax returns and joint bank statements, lease, photos in a folder.", onScreenText: "SPONSOR PAPERS + JOINT PROOF\nOrganised by date", narration: "Your sponsor's papers, and your joint proof — lease, bank statements, photos — organised by date." },
      { scene: 5, time: "0:48–1:00", visual: "Client zips the bag, ready. Website name big, top and bottom.", onScreenText: "READ YOUR NOTICE FIRST\nimmigration.niptei.com", narration: "Your appointment notice lists exactly what to bring. Read it first — at immigration.niptei.com." },
    ],
  },
  {
    id: "vid-marriage-interview",
    title: "Marriage Interview: Answering Together, Honestly",
    interviewType: "I-485 adjustment of status",
    lengthSeconds: 60,
    format: "9:16 vertical — website name big and readable, top and bottom, in every scene",
    status: "Video script — not a finished video",
    purpose: "A married couple learns that the officer is checking for a real shared life, not a rehearsed story — answer in your own words.",
    scenes: [
      { scene: 1, time: "0:00–0:10", visual: "Couple sits together at home, cooking, laughing — a real shared life.", onScreenText: "A REAL MARRIAGE\nIs a shared life", narration: "A marriage interview is not a memory test. The officer is checking for a real shared life." },
      { scene: 2, time: "0:10–0:22", visual: "Officer asks each spouse the same question in separate rooms.", onScreenText: "YOU MAY BE ASKED\nSEPARATELY", narration: "You may be asked the same questions separately. That is normal." },
      { scene: 3, time: "0:22–0:36", visual: "Spouse answers in their own words about a normal weekend.", onScreenText: "ANSWER IN YOUR OWN WORDS\nDo not rehearse a story", narration: "Answer in your own words. Officers can tell when two people rehearsed the same story — a real life sounds different from a script." },
      { scene: 4, time: "0:36–0:48", visual: "Joint evidence: lease with both names, joint bank card, photos with family.", onScreenText: "SHOW IT WITH DOCUMENTS\nLease • Bank • Photos", narration: "Show it with documents — a lease with both names, joint bank statements, photos with family." },
      { scene: 5, time: "0:48–1:00", visual: "Couple walks out of the office together, calm. Website name big, top and bottom.", onScreenText: "TRUTH + DOCUMENTS\nimmigration.niptei.com", narration: "Truth, plus documents. Prepare with us at immigration.niptei.com." },
    ],
  },
  {
    id: "vid-consular",
    title: "Consular Interview Abroad: Your Checklist",
    interviewType: "Consular (immigrant visa)",
    lengthSeconds: 60,
    format: "9:16 vertical — website name big and readable, top and bottom, in every scene",
    status: "Video script — not a finished video",
    purpose: "A beneficiary abroad prepares for the embassy interview: medical exam first, originals, police certificates, sponsor papers.",
    scenes: [
      { scene: 1, time: "0:00–0:10", visual: "Beneficiary reads the embassy appointment letter.", onScreenText: "YOUR EMBASSY INTERVIEW\nRead the letter first", narration: "Your embassy interview starts before the interview day — with the letter. Read it first. Every embassy has its own steps." },
      { scene: 2, time: "0:10–0:24", visual: "Medical exam at the panel physician's clinic.", onScreenText: "MEDICAL EXAM FIRST\nPanel physician only", narration: "Do the medical exam first, with the panel physician the embassy names — not your own doctor." },
      { scene: 3, time: "0:24–0:36", visual: "Originals laid out: birth certificate, police certificate, passport.", onScreenText: "ORIGINALS + TRANSLATIONS\nPolice certificates too", narration: "Bring originals — birth, marriage, police certificates — plus certified translations if they are not in English." },
      { scene: 4, time: "0:36–0:48", visual: "Sponsor's I-864 and tax returns; DS-260 confirmation page.", onScreenText: "SPONSOR PAPERS\nDS-260 CONFIRMATION", narration: "Your sponsor's papers, and your DS-260 confirmation page. The officer already has your file — answer truthfully." },
      { scene: 5, time: "0:48–1:00", visual: "Beneficiary arrives at the embassy, calm and ready.", onScreenText: "ARRIVE EARLY • BE HONEST\nimmigration.niptei.com", narration: "Arrive early. Be honest. Prepare with us at immigration.niptei.com." },
    ],
  },
  {
    id: "vid-what-they-look-for",
    title: "What Immigration Is Looking For — and What Slows a Case Down",
    interviewType: "N-400 naturalization",
    lengthSeconds: 60,
    format: "9:16 vertical — website name big and readable, top and bottom, in every scene",
    status: "Video script — not a finished video",
    purpose: "Honest expectations: what officers check, what delays cases, and why no one can promise an outcome.",
    scenes: [
      { scene: 1, time: "0:00–0:10", visual: "Officer reviews a file; three words appear: identity, eligibility, consistency.", onScreenText: "WHAT ARE THEY CHECKING?\nIdentity • Eligibility • Consistency", narration: "What is immigration looking for? Three things: your identity, your eligibility, and consistency." },
      { scene: 2, time: "0:10–0:24", visual: "Application, testimony, and documents line up side by side.", onScreenText: "YOUR WORDS MUST MATCH\nYour application + documents", narration: "What you say must match your application and your documents. Small honest mistakes can be corrected. Contradictions are a problem." },
      { scene: 3, time: "0:24–0:38", visual: "Calendar pages flip: missing document, missed letter, missed deadline.", onScreenText: "WHAT SLOWS A CASE DOWN?\nMissing papers • Missed letters", narration: "What slows a case down? Missing papers. A letter you did not open. An address you did not update." },
      { scene: 4, time: "0:38–0:50", visual: "A stamp that reads NO GUARANTEE is crossed out; a checklist appears instead.", onScreenText: "NO ONE CAN PROMISE\nAN OUTCOME", narration: "No one can promise an outcome — not us, not anyone. Preparation helps you answer clearly. It does not guarantee approval." },
      { scene: 5, time: "0:50–1:00", visual: "Client checks off a preparation checklist and smiles.", onScreenText: "PREPARE WELL\nimmigration.niptei.com", narration: "Prepare well. Know your application. Bring your documents. At immigration.niptei.com." },
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers (pure — used by the API route and the smoke test)
// ---------------------------------------------------------------------------

export function allInterviewQuestions(): InterviewQuestion[] {
  return INTERVIEW_BANKS.flatMap((b) => b.questions);
}

export function interviewQuestionCounts(): {
  total: number;
  officialCivics: number;
  practice: number;
  perBank: { bankId: string; title: string; count: number; official: number; practice: number }[];
} {
  const questions = allInterviewQuestions();
  return {
    total: questions.length,
    officialCivics: questions.filter((q) => q.kind === "official_civics").length,
    practice: questions.filter((q) => q.kind === "practice").length,
    perBank: INTERVIEW_BANKS.map((b) => ({
      bankId: b.id,
      title: b.title,
      count: b.questions.length,
      official: b.questions.filter((q) => q.kind === "official_civics").length,
      practice: b.questions.filter((q) => q.kind === "practice").length,
    })),
  };
}

/** True only when every question carries a source label AND a URL. */
export function allInterviewQuestionsHaveSources(): boolean {
  return allInterviewQuestions().every(
    (q) =>
      q.source.label.trim().length > 0 &&
      q.source.url.startsWith("https://www.uscis.gov/") &&
      q.source.basedOn.trim().length > 0
  );
}

/** True only when every practice question is labelled as practice in its
 *  source text (never presented as official). */
export function allPracticeQuestionsLabelledNotOfficial(): boolean {
  return allInterviewQuestions()
    .filter((q) => q.kind === "practice")
    .every((q) => q.source.basedOn.includes("NOT official"));
}
