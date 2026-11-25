// HowItWorks — plain-English guides, in the client's language with the
// English original beside it. Built-in translations (Google Translate is
// NOT connected — other languages fall back to English and say so).
//   Client: "How this works for you" — inside US vs outside US.
//   Professional: "How to service this client in 5 minutes a day".
"use client";

import type { LanguageCode } from "@/lib/i18n";
import { nextStepLang } from "@/lib/nextStepEngine";

const CLIENT_GUIDE: { en: string; es: string; ht: string; fr: string; pt: string }[] = [
  {
    en: "1. You answer questions and upload your documents. Green means approved, blue means we received it and are reviewing it, amber means we are working on it, red means something is missing or needs a new copy, grey means not started yet.",
    es: "1. Usted responde preguntas y sube sus documentos. Verde significa aprobado, azul significa que lo recibimos y lo estamos revisando, ámbar significa que estamos trabajando en eso, rojo significa que falta algo o necesita una copia nueva, gris significa que aún no ha empezado.",
    ht: "1. Ou reponn kesyon yo epi ou voye dokiman ou yo. Vèt vle di apwouve, ble vle di nou resevwa li epi n ap revize li, jòn vle di n ap travay sou li, wouj vle di yon bagay manke oswa li bezwen yon nouvo kopi, gri vle di li poko kòmanse.",
    fr: "1. Vous répondez aux questions et envoyez vos documents. Vert signifie approuvé, bleu signifie reçu et en cours de révision, orange signifie en cours de traitement, rouge signifie qu'il manque quelque chose ou qu'une nouvelle copie est nécessaire, gris signifie pas encore commencé.",
    pt: "1. Você responde às perguntas e envia seus documentos. Verde significa aprovado, azul significa que recebemos e estamos revisando, âmbar significa que estamos trabalhando nisso, vermelho significa que falta algo ou precisa de uma nova cópia, cinza significa ainda não iniciado.",
  },
  {
    en: "2. Your provider prepares your forms. You always see one next step at the top: what to do, by when, and what happens after that.",
    es: "2. Su preparador prepara sus formularios. Siempre verá un próximo paso arriba: qué hacer, para cuándo, y qué pasa después.",
    ht: "2. Moun k ap ede ou la prepare fòm ou yo. Ou ap toujou wè yon sèl pwochen etap anwo a: sa pou ou fè, pou kilè, ak sa k ap pase apre sa.",
    fr: "2. Votre préparateur prépare vos formulaires. Vous voyez toujours une prochaine étape en haut : quoi faire, pour quand, et ce qui se passe ensuite.",
    pt: "2. Seu preparador prepara seus formulários. Você sempre vê um próximo passo no topo: o que fazer, até quando, e o que acontece depois.",
  },
  {
    en: "3. If you are INSIDE the United States, your case stays with USCIS: receipt, biometrics, work permit if ordered, interview if scheduled, approval, Green Card in the mail. No NVC, no CEAC, no DS-260, no embassy interview.",
    es: "3. Si está DENTRO de los Estados Unidos, su caso se queda con USCIS: recibo, biometría, permiso de trabajo si se pidió, entrevista si se programa, aprobación, Green Card por correo. No NVC, no CEAC, no DS-260, no entrevista en la embajada.",
    ht: "3. Si ou ANNDAN Etazini, dosye ou a rete ak USCIS: resi, byometrik, pèmi travay si yo te mande li, entèvyou si yo pwograme li, apwobasyon, Green Card nan lapòs. Pa gen NVC, pa gen CEAC, pa gen DS-260, pa gen entèvyou nan anbasad.",
    fr: "3. Si vous êtes AUX États-Unis, votre dossier reste chez USCIS : récépissé, biométrie, permis de travail si demandé, entretien si programmé, approbation, Green Card par courrier. Pas de NVC, pas de CEAC, pas de DS-260, pas d'entretien à l'ambassade.",
    pt: "3. Se você está DENTRO dos Estados Unidos, seu caso fica com o USCIS: recibo, biometria, permissão de trabalho se solicitada, entrevista se agendada, aprovação, Green Card pelo correio. Sem NVC, sem CEAC, sem DS-260, sem entrevista na embaixada.",
  },
  {
    en: "4. If your family member is OUTSIDE the United States, after USCIS approves the case it goes to NVC: Welcome Letter, pay $120 + $325 in CEAC, DS-260, documents, then the embassy interview and the $235 Immigrant Fee before flying.",
    es: "4. Si su familiar está FUERA de los Estados Unidos, después de que USCIS apruebe el caso, va al NVC: Carta de Bienvenida, pague $120 + $325 en CEAC, DS-260, documentos, luego la entrevista en la embajada y la tarifa de inmigrante de $235 antes de volar.",
    ht: "4. Si manm fanmi ou la DEYÒ Etazini, apre USCIS apwouve dosye a, li ale nan NVC: Lèt Byenvini, peye $120 + $325 nan CEAC, DS-260, dokiman, apre sa entèvyou nan anbasad la ak frè imigran $235 anvan ou vwayaje.",
    fr: "4. Si votre proche est HORS des États-Unis, après l'approbation par USCIS, le dossier va au NVC : lettre de bienvenue, payez 120 $ + 325 $ dans CEAC, DS-260, documents, puis l'entretien à l'ambassade et les 235 $ de frais d'immigrant avant de partir.",
    pt: "4. Se seu familiar está FORA dos Estados Unidos, após a aprovação do USCIS, o caso vai para o NVC: Carta de Boas-Vindas, pague $120 + $325 no CEAC, DS-260, documentos, depois a entrevista na embaixada e a taxa de imigrante de $235 antes de voar.",
  },
  {
    en: "5. Government fees are always separate from the prep fee, and each one is paid at its own step — never all at once. The \"When should I pay?\" list shows each fee at the step where it is due.",
    es: "5. Las tarifas del gobierno siempre están separadas de la tarifa de preparación, y cada una se paga en su propio paso — nunca todas a la vez. La lista \"¿Cuándo debo pagar?\" muestra cada tarifa en el paso donde vence.",
    ht: "5. Frè gouvènman an toujou separe ak frè preparasyon an, epi yo peye chak frè nan etap pa li — pa tout ansanm. Lis \"Kilè mwen dwe peye?\" la montre chak frè nan etap kote li dwe peye a.",
    fr: "5. Les frais gouvernementaux sont toujours séparés des frais de préparation, et chacun est payé à sa propre étape — jamais tous en une fois. La liste « Quand dois-je payer ? » montre chaque frais à l'étape où il est dû.",
    pt: "5. As taxas do governo são sempre separadas da taxa de preparação, e cada uma é paga na sua própria etapa — nunca todas de uma vez. A lista \"Quando devo pagar?\" mostra cada taxa na etapa em que vence.",
  },
];

const PRO_GUIDE: string[] = [
  "1. Open Daily Command: today's deadlines, overdue items, new messages, new uploads. Clear the red items first.",
  "2. Read the Next Step card: it tells you the one thing this client needs next, by when, and what happens after. If the route is wrong, switch it with a reason — it is logged.",
  "3. Review the colour checklist: blue uploads need your review, red items need a retake or a nudge, amber items are waiting on you or the client. Packet readiness % comes from these colours.",
  "4. Check the Payment Centre: any overdue invoice gets a 48h past-due nudge (queued — Twilio / Resend not connected). Offer only Pay in Full / Pay in 3 / Monthly 6 / 12 — never 50/50. Show the 50% missed-payment math before a client misses a payment, not after.",
  "5. Reply in the unified thread (portal chat, SMS, WhatsApp, email) — original + English side by side. Never claim a message was sent until your own Twilio / Resend account is connected and the status says sent.",
];

export function HowThisWorksClient(props: { language: LanguageCode }) {
  const lang = nextStepLang(props.language);
  return (
    <section
      aria-labelledby="how-it-works-heading"
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 id="how-it-works-heading" className="text-base font-semibold">
        How this works for you
        {lang !== "en" && (
          <span className="block text-sm font-normal text-slate-500">
            Cómo funciona esto para usted
          </span>
        )}
      </h2>
      <ol className="mt-3 space-y-2 text-sm">
        {CLIENT_GUIDE.map((step, i) => (
          <li key={i} className="rounded border border-slate-200 px-3 py-2">
            <p>{step[lang]}</p>
            {lang !== "en" && (
              <p className="mt-1 text-slate-500">{step.en}</p>
            )}
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs text-slate-500">
        Clerical / educational help only — not a law firm, not affiliated with
        USCIS, no approval guarantee. Only a licensed attorney or a
        DOJ-Accredited Representative gives legal advice or represents a
        client (8 CFR 292.1).
      </p>
    </section>
  );
}

export function HowToServiceClient() {
  return (
    <section
      aria-labelledby="how-to-service-heading"
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 id="how-to-service-heading" className="text-base font-semibold">
        How to service this client in 5 minutes a day
      </h2>
      <ol className="mt-3 space-y-2 text-sm">
        {PRO_GUIDE.map((step) => (
          <li key={step} className="rounded border border-slate-200 px-3 py-2">
            {step}
          </li>
        ))}
      </ol>
    </section>
  );
}
