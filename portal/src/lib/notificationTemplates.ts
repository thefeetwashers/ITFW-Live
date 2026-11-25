// Automated notification templates — stage keys 1-6, all 7 platform
// languages (EN, ES, HT, FR, PT, ZH, AR — see src/lib/i18n.ts).
//
// CORRECTIONS vs the pasted draft (do not re-introduce them):
//  * Portal URL is https://immigration.niptei.com — NOT https://niptei.com.
//  * Sender is NOT updates@niptei.com (unverified). The placeholder
//    sender below is labelled "needs verified Resend domain"; the real
//    contact address in every footer is nipteiapp@gmail.com.
//  * NO A-Number appears in any template, ever.
//  * {{caseNumber}} (USCIS receipt / NVC case number) appears ONLY in
//    the at_uscis + nvc_processing templates — in the email body and
//    the SMS/WhatsApp text, NEVER in an email subject. Case numbers
//    belong in the portal link, not in SMS subjects. The route
//    (src/app/api/notify-stage/route.ts) drops {{caseNumber}} for
//    every other stage.
//  * Twilio / Resend are NOT connected. No keys in this file.
//
// AUTHORSHIP NOTE: no founder-supplied EN/ES/HT template text was
// found anywhere in this repo (searched src/ + supabase/ + your_files
// for the stage keys), so the EN/ES/HT text below was authored here
// in the founder's plain style. FR/PT/ZH/AR are agent translations
// of the same EN text — they MUST be reviewed by the founder / a
// native speaker before any live send.
//
// Placeholders (rendered by renderTemplate):
//   {{name}} {{service}} {{amount}} {{invoiceId}} {{caseNumber}}
//   {{missingCount}} {{portalUrl}}

import type { LanguageCode } from "./i18n";

export const PORTAL_URL = "https://immigration.niptei.com";

// Placeholder sender — NOT verified. Do not change this to a real
// sending address until the Resend domain is verified; until then
// the route returns 501 and sends nothing.
export const NOTIFICATION_SENDER = {
  name: "Immigration with NIPTEI",
  email: "notifications@immigration.niptei.com",
  verified: false,
  note: "Needs verified Resend domain — do not send from this address until verified.",
} as const;

// Real contact address, printed in the footer of every template.
export const CONTACT_EMAIL = "nipteiapp@gmail.com";

// Stage keys, in the founder's 1-6 order.
export const STAGE_KEYS = [
  "quote_sent",
  "payment_plan",
  "active_drafting",
  "at_uscis",
  "nvc_processing",
  "visa_travel_closed",
] as const;

export type NotificationStageKey = (typeof STAGE_KEYS)[number];

export const STAGE_NUMBERS: Record<NotificationStageKey, number> = {
  quote_sent: 1,
  payment_plan: 2,
  active_drafting: 3,
  at_uscis: 4,
  nvc_processing: 5,
  visa_travel_closed: 6,
};

export function stageKeyForNumber(n: number): NotificationStageKey | null {
  return (
    (Object.keys(STAGE_NUMBERS) as NotificationStageKey[]).find(
      (k) => STAGE_NUMBERS[k] === n
    ) ?? null
  );
}

export interface NotificationTemplate {
  emailSubject: string;
  emailBody: string;
  // SMS text. WhatsApp reuses this same text (via Twilio WhatsApp,
  // which needs WhatsApp Business approval — see the route).
  smsText: string;
}

type StageTemplates = Record<NotificationStageKey, NotificationTemplate>;

function t(
  emailSubject: string,
  emailBody: string,
  smsText: string
): NotificationTemplate {
  return { emailSubject, emailBody, smsText };
}

export const NOTIFICATION_TEMPLATES: Record<LanguageCode, StageTemplates> = {
  en: {
    quote_sent: t(
      "Your Immigration with NIPTEI quote is ready — {{service}}",
      "Hello {{name}},\n\nYour quote for {{service}} is ready. The service fee is {{amount}}. Please review it in your portal and let us know if you would like to go ahead.\n\nView your quote: {{portalUrl}}\n\nQuestions? Write to nipteiapp@gmail.com.\n\nImmigration with NIPTEI — https://immigration.niptei.com",
      "Hello {{name}}, your Immigration with NIPTEI quote for {{service}} is ready: {{amount}}. Review it here: {{portalUrl}} Questions? nipteiapp@gmail.com"
    ),
    payment_plan: t(
      "Your payment plan is set up — Invoice {{invoiceId}}",
      "Hello {{name}},\n\nYour payment plan for {{service}} is set up. Invoice {{invoiceId}} — {{amount}}. You can pay it or view it in your portal.\n\nView your plan: {{portalUrl}}\n\nQuestions? Write to nipteiapp@gmail.com.\n\nImmigration with NIPTEI — https://immigration.niptei.com",
      "Hello {{name}}, your payment plan for {{service}} is set up. Invoice {{invoiceId}} — {{amount}}. Pay or view it here: {{portalUrl}} Questions? nipteiapp@gmail.com"
    ),
    active_drafting: t(
      "We are drafting your {{service}} — {{missingCount}} item(s) still missing",
      "Hello {{name}},\n\nWe are drafting your {{service}}. {{missingCount}} item(s) are still missing. Please upload them in your portal.\n\nUpload documents: {{portalUrl}}\n\nQuestions? Write to nipteiapp@gmail.com.\n\nImmigration with NIPTEI — https://immigration.niptei.com",
      "Hello {{name}}, we are drafting your {{service}}. {{missingCount}} item(s) are still missing — please upload them here: {{portalUrl}} Questions? nipteiapp@gmail.com"
    ),
    at_uscis: t(
      "Your case is now with USCIS — check your portal",
      "Hello {{name}},\n\nYour {{service}} case is now with USCIS. Receipt number: {{caseNumber}}. You can track its status in your portal.\n\nView your case: {{portalUrl}}\n\nQuestions? Write to nipteiapp@gmail.com.\n\nImmigration with NIPTEI — https://immigration.niptei.com",
      "Hello {{name}}, your {{service}} case is now with USCIS. Receipt: {{caseNumber}}. Track it here: {{portalUrl}} Questions? nipteiapp@gmail.com"
    ),
    nvc_processing: t(
      "Your case is now with the National Visa Center — check your portal",
      "Hello {{name}},\n\nYour {{service}} case is now with the National Visa Center (NVC). Case number: {{caseNumber}}, invoice: {{invoiceId}}. Check your portal to see what is still needed.\n\nView your case: {{portalUrl}}\n\nQuestions? Write to nipteiapp@gmail.com.\n\nImmigration with NIPTEI — https://immigration.niptei.com",
      "Hello {{name}}, your {{service}} case is now with the National Visa Center. Case: {{caseNumber}}. See what is needed here: {{portalUrl}} Questions? nipteiapp@gmail.com"
    ),
    visa_travel_closed: t(
      "Your visa / travel case is closed — Immigration with NIPTEI",
      "Hello {{name}},\n\nYour {{service}} visa / travel case is now closed. Your final documents are in your portal.\n\nView your documents: {{portalUrl}}\n\nQuestions? Write to nipteiapp@gmail.com.\n\nImmigration with NIPTEI — https://immigration.niptei.com",
      "Hello {{name}}, your {{service}} visa / travel case is now closed. Your final documents are here: {{portalUrl}} Questions? nipteiapp@gmail.com"
    ),
  },
  es: {
    quote_sent: t(
      "Su cotización de Immigration with NIPTEI está lista — {{service}}",
      "Hola {{name}},\n\nSu cotización para {{service}} está lista. La tarifa del servicio es {{amount}}. Revísela en su portal y avísenos si desea continuar.\n\nVer su cotización: {{portalUrl}}\n\n¿Preguntas? Escríbanos a nipteiapp@gmail.com.\n\nImmigration with NIPTEI — https://immigration.niptei.com",
      "Hola {{name}}, su cotización de Immigration with NIPTEI para {{service}} está lista: {{amount}}. Revísela aquí: {{portalUrl}} ¿Preguntas? nipteiapp@gmail.com"
    ),
    payment_plan: t(
      "Su plan de pago está listo — Factura {{invoiceId}}",
      "Hola {{name}},\n\nSu plan de pago para {{service}} está listo. Factura {{invoiceId}} — {{amount}}. Puede pagarla o verla en su portal.\n\nVer su plan: {{portalUrl}}\n\n¿Preguntas? Escríbanos a nipteiapp@gmail.com.\n\nImmigration with NIPTEI — https://immigration.niptei.com",
      "Hola {{name}}, su plan de pago para {{service}} está listo. Factura {{invoiceId}} — {{amount}}. Páguela o véala aquí: {{portalUrl}} ¿Preguntas? nipteiapp@gmail.com"
    ),
    active_drafting: t(
      "Estamos preparando su {{service}} — faltan {{missingCount}} documento(s)",
      "Hola {{name}},\n\nEstamos preparando su {{service}}. Todavía faltan {{missingCount}} documento(s). Por favor, súbalos en su portal.\n\nSubir documentos: {{portalUrl}}\n\n¿Preguntas? Escríbanos a nipteiapp@gmail.com.\n\nImmigration with NIPTEI — https://immigration.niptei.com",
      "Hola {{name}}, estamos preparando su {{service}}. Faltan {{missingCount}} documento(s) — por favor, súbalos aquí: {{portalUrl}} ¿Preguntas? nipteiapp@gmail.com"
    ),
    at_uscis: t(
      "Su caso ya está en USCIS — revise su portal",
      "Hola {{name}},\n\nSu caso de {{service}} ya está en USCIS. Número de recibo: {{caseNumber}}. Puede seguir su estado en su portal.\n\nVer su caso: {{portalUrl}}\n\n¿Preguntas? Escríbanos a nipteiapp@gmail.com.\n\nImmigration with NIPTEI — https://immigration.niptei.com",
      "Hola {{name}}, su caso de {{service}} ya está en USCIS. Recibo: {{caseNumber}}. Siga su estado aquí: {{portalUrl}} ¿Preguntas? nipteiapp@gmail.com"
    ),
    nvc_processing: t(
      "Su caso ya está en el Centro Nacional de Visas — revise su portal",
      "Hola {{name}},\n\nSu caso de {{service}} ya está en el Centro Nacional de Visas (NVC). Número de caso: {{caseNumber}}, factura: {{invoiceId}}. Revise en su portal lo que hace falta.\n\nVer su caso: {{portalUrl}}\n\n¿Preguntas? Escríbanos a nipteiapp@gmail.com.\n\nImmigration with NIPTEI — https://immigration.niptei.com",
      "Hola {{name}}, su caso de {{service}} ya está en el Centro Nacional de Visas. Caso: {{caseNumber}}. Vea lo que hace falta aquí: {{portalUrl}} ¿Preguntas? nipteiapp@gmail.com"
    ),
    visa_travel_closed: t(
      "Su caso de visa / viaje está cerrado — Immigration with NIPTEI",
      "Hola {{name}},\n\nSu caso de visa / viaje de {{service}} ya está cerrado. Sus documentos finales están en su portal.\n\nVer sus documentos: {{portalUrl}}\n\n¿Preguntas? Escríbanos a nipteiapp@gmail.com.\n\nImmigration with NIPTEI — https://immigration.niptei.com",
      "Hola {{name}}, su caso de visa / viaje de {{service}} ya está cerrado. Sus documentos finales están aquí: {{portalUrl}} ¿Preguntas? nipteiapp@gmail.com"
    ),
  },
  ht: {
    quote_sent: t(
      "Estimasyon pri ou a pare — {{service}}",
      "Bonjou {{name}},\n\nEstimasyon pri ou pou {{service}} pare. Pri sèvis la se {{amount}}. Tanpri gade li nan pòtal ou a epi di nou si ou vle kontinye.\n\nGade estimasyon ou a: {{portalUrl}}\n\nKesyon? Ekri nou nan nipteiapp@gmail.com.\n\nImmigration with NIPTEI — https://immigration.niptei.com",
      "Bonjou {{name}}, estimasyon pri Immigration with NIPTEI ou pou {{service}} pare: {{amount}}. Gade li isit la: {{portalUrl}} Kesyon? nipteiapp@gmail.com"
    ),
    payment_plan: t(
      "Plan peman ou a pare — Fakti {{invoiceId}}",
      "Bonjou {{name}},\n\nPlan peman ou pou {{service}} pare. Fakti {{invoiceId}} — {{amount}}. Ou ka peye li oswa gade li nan pòtal ou a.\n\nGade plan ou a: {{portalUrl}}\n\nKesyon? Ekri nou nan nipteiapp@gmail.com.\n\nImmigration with NIPTEI — https://immigration.niptei.com",
      "Bonjou {{name}}, plan peman ou pou {{service}} pare. Fakti {{invoiceId}} — {{amount}}. Peye li oswa gade li isit la: {{portalUrl}} Kesyon? nipteiapp@gmail.com"
    ),
    active_drafting: t(
      "N ap prepare {{service}} ou a — gen {{missingCount}} dokiman ki manke",
      "Bonjou {{name}},\n\nN ap prepare {{service}} ou a. Gen {{missingCount}} dokiman ki manke toujou. Tanpri mete yo nan pòtal ou a.\n\nMete dokiman yo: {{portalUrl}}\n\nKesyon? Ekri nou nan nipteiapp@gmail.com.\n\nImmigration with NIPTEI — https://immigration.niptei.com",
      "Bonjou {{name}}, n ap prepare {{service}} ou a. Gen {{missingCount}} dokiman ki manke — tanpri mete yo isit la: {{portalUrl}} Kesyon? nipteiapp@gmail.com"
    ),
    at_uscis: t(
      "Dosye ou a nan USCIS kounye a — gade pòtal ou a",
      "Bonjou {{name}},\n\nDosye {{service}} ou a nan USCIS kounye a. Nimewo resi a: {{caseNumber}}. Ou ka swiv li nan pòtal ou a.\n\nGade dosye ou a: {{portalUrl}}\n\nKesyon? Ekri nou nan nipteiapp@gmail.com.\n\nImmigration with NIPTEI — https://immigration.niptei.com",
      "Bonjou {{name}}, dosye {{service}} ou a nan USCIS kounye a. Resi: {{caseNumber}}. Swiv li isit la: {{portalUrl}} Kesyon? nipteiapp@gmail.com"
    ),
    nvc_processing: t(
      "Dosye ou a nan Sant Nasyonal Viza a kounye a — gade pòtal ou a",
      "Bonjou {{name}},\n\nDosye {{service}} ou a nan Sant Nasyonal Viza a (NVC) kounye a. Nimewo dosye a: {{caseNumber}}, fakti: {{invoiceId}}. Gade nan pòtal ou a sa ki manke.\n\nGade dosye ou a: {{portalUrl}}\n\nKesyon? Ekri nou nan nipteiapp@gmail.com.\n\nImmigration with NIPTEI — https://immigration.niptei.com",
      "Bonjou {{name}}, dosye {{service}} ou a nan Sant Nasyonal Viza a kounye a. Dosye: {{caseNumber}}. Gade sa ki manke isit la: {{portalUrl}} Kesyon? nipteiapp@gmail.com"
    ),
    visa_travel_closed: t(
      "Dosye viza / vwayaj ou a fèmen — Immigration with NIPTEI",
      "Bonjou {{name}},\n\nDosye viza / vwayaj {{service}} ou a fèmen kounye a. Dokiman final ou yo nan pòtal ou a.\n\nGade dokiman ou yo: {{portalUrl}}\n\nKesyon? Ekri nou nan nipteiapp@gmail.com.\n\nImmigration with NIPTEI — https://immigration.niptei.com",
      "Bonjou {{name}}, dosye viza / vwayaj {{service}} ou a fèmen kounye a. Dokiman final ou yo isit la: {{portalUrl}} Kesyon? nipteiapp@gmail.com"
    ),
  },
  fr: {
    quote_sent: t(
      "Votre devis Immigration with NIPTEI est prêt — {{service}}",
      "Bonjour {{name}},\n\nVotre devis pour {{service}} est prêt. Les frais de service sont de {{amount}}. Veuillez le consulter dans votre portail et nous dire si vous souhaitez continuer.\n\nVoir votre devis : {{portalUrl}}\n\nDes questions ? Écrivez-nous à nipteiapp@gmail.com.\n\nImmigration with NIPTEI — https://immigration.niptei.com",
      "Bonjour {{name}}, votre devis Immigration with NIPTEI pour {{service}} est prêt : {{amount}}. Consultez-le ici : {{portalUrl}} Questions ? nipteiapp@gmail.com"
    ),
    payment_plan: t(
      "Votre plan de paiement est en place — Facture {{invoiceId}}",
      "Bonjour {{name}},\n\nVotre plan de paiement pour {{service}} est en place. Facture {{invoiceId}} — {{amount}}. Vous pouvez le payer ou le consulter dans votre portail.\n\nVoir votre plan : {{portalUrl}}\n\nDes questions ? Écrivez-nous à nipteiapp@gmail.com.\n\nImmigration with NIPTEI — https://immigration.niptei.com",
      "Bonjour {{name}}, votre plan de paiement pour {{service}} est en place. Facture {{invoiceId}} — {{amount}}. Payez ou consultez ici : {{portalUrl}} Questions ? nipteiapp@gmail.com"
    ),
    active_drafting: t(
      "Nous préparons votre {{service}} — il manque {{missingCount}} document(s)",
      "Bonjour {{name}},\n\nNous préparons votre {{service}}. Il manque encore {{missingCount}} document(s). Veuillez les téléverser dans votre portail.\n\nTéléverser vos documents : {{portalUrl}}\n\nDes questions ? Écrivez-nous à nipteiapp@gmail.com.\n\nImmigration with NIPTEI — https://immigration.niptei.com",
      "Bonjour {{name}}, nous préparons votre {{service}}. Il manque {{missingCount}} document(s) — veuillez les téléverser ici : {{portalUrl}} Questions ? nipteiapp@gmail.com"
    ),
    at_uscis: t(
      "Votre dossier est maintenant à l'USCIS — consultez votre portail",
      "Bonjour {{name}},\n\nVotre dossier {{service}} est maintenant à l'USCIS. Numéro de récépissé : {{caseNumber}}. Vous pouvez suivre son état dans votre portail.\n\nVoir votre dossier : {{portalUrl}}\n\nDes questions ? Écrivez-nous à nipteiapp@gmail.com.\n\nImmigration with NIPTEI — https://immigration.niptei.com",
      "Bonjour {{name}}, votre dossier {{service}} est maintenant à l'USCIS. Récépissé : {{caseNumber}}. Suivez-le ici : {{portalUrl}} Questions ? nipteiapp@gmail.com"
    ),
    nvc_processing: t(
      "Votre dossier est maintenant au Centre national des visas — consultez votre portail",
      "Bonjour {{name}},\n\nVotre dossier {{service}} est maintenant au Centre national des visas (NVC). Numéro de dossier : {{caseNumber}}, facture : {{invoiceId}}. Consultez votre portail pour voir ce qui manque.\n\nVoir votre dossier : {{portalUrl}}\n\nDes questions ? Écrivez-nous à nipteiapp@gmail.com.\n\nImmigration with NIPTEI — https://immigration.niptei.com",
      "Bonjour {{name}}, votre dossier {{service}} est maintenant au Centre national des visas. Dossier : {{caseNumber}}. Voyez ce qui manque ici : {{portalUrl}} Questions ? nipteiapp@gmail.com"
    ),
    visa_travel_closed: t(
      "Votre dossier de visa / voyage est clôturé — Immigration with NIPTEI",
      "Bonjour {{name}},\n\nVotre dossier de visa / voyage {{service}} est maintenant clôturé. Vos documents finaux sont dans votre portail.\n\nVoir vos documents : {{portalUrl}}\n\nDes questions ? Écrivez-nous à nipteiapp@gmail.com.\n\nImmigration with NIPTEI — https://immigration.niptei.com",
      "Bonjour {{name}}, votre dossier de visa / voyage {{service}} est maintenant clôturé. Vos documents finaux sont ici : {{portalUrl}} Questions ? nipteiapp@gmail.com"
    ),
  },
  pt: {
    quote_sent: t(
      "Seu orçamento da Immigration with NIPTEI está pronto — {{service}}",
      "Olá {{name}},\n\nSeu orçamento para {{service}} está pronto. A taxa de serviço é {{amount}}. Por favor, revise-o no seu portal e diga-nos se deseja continuar.\n\nVer seu orçamento: {{portalUrl}}\n\nDúvidas? Escreva para nipteiapp@gmail.com.\n\nImmigration with NIPTEI — https://immigration.niptei.com",
      "Olá {{name}}, seu orçamento da Immigration with NIPTEI para {{service}} está pronto: {{amount}}. Revise-o aqui: {{portalUrl}} Dúvidas? nipteiapp@gmail.com"
    ),
    payment_plan: t(
      "Seu plano de pagamento está pronto — Fatura {{invoiceId}}",
      "Olá {{name}},\n\nSeu plano de pagamento para {{service}} está pronto. Fatura {{invoiceId}} — {{amount}}. Você pode pagá-la ou vê-la no seu portal.\n\nVer seu plano: {{portalUrl}}\n\nDúvidas? Escreva para nipteiapp@gmail.com.\n\nImmigration with NIPTEI — https://immigration.niptei.com",
      "Olá {{name}}, seu plano de pagamento para {{service}} está pronto. Fatura {{invoiceId}} — {{amount}}. Pague ou veja aqui: {{portalUrl}} Dúvidas? nipteiapp@gmail.com"
    ),
    active_drafting: t(
      "Estamos preparando seu {{service}} — ainda faltam {{missingCount}} documento(s)",
      "Olá {{name}},\n\nEstamos preparando seu {{service}}. Ainda faltam {{missingCount}} documento(s). Por favor, envie-os no seu portal.\n\nEnviar documentos: {{portalUrl}}\n\nDúvidas? Escreva para nipteiapp@gmail.com.\n\nImmigration with NIPTEI — https://immigration.niptei.com",
      "Olá {{name}}, estamos preparando seu {{service}}. Ainda faltam {{missingCount}} documento(s) — por favor, envie-os aqui: {{portalUrl}} Dúvidas? nipteiapp@gmail.com"
    ),
    at_uscis: t(
      "Seu caso já está no USCIS — confira seu portal",
      "Olá {{name}},\n\nSeu caso de {{service}} já está no USCIS. Número do recibo: {{caseNumber}}. Você pode acompanhar o andamento no seu portal.\n\nVer seu caso: {{portalUrl}}\n\nDúvidas? Escreva para nipteiapp@gmail.com.\n\nImmigration with NIPTEI — https://immigration.niptei.com",
      "Olá {{name}}, seu caso de {{service}} já está no USCIS. Recibo: {{caseNumber}}. Acompanhe aqui: {{portalUrl}} Dúvidas? nipteiapp@gmail.com"
    ),
    nvc_processing: t(
      "Seu caso já está no Centro Nacional de Vistos — confira seu portal",
      "Olá {{name}},\n\nSeu caso de {{service}} já está no Centro Nacional de Vistos (NVC). Número do caso: {{caseNumber}}, fatura: {{invoiceId}}. Confira no seu portal o que ainda falta.\n\nVer seu caso: {{portalUrl}}\n\nDúvidas? Escreva para nipteiapp@gmail.com.\n\nImmigration with NIPTEI — https://immigration.niptei.com",
      "Olá {{name}}, seu caso de {{service}} já está no Centro Nacional de Vistos. Caso: {{caseNumber}}. Veja o que falta aqui: {{portalUrl}} Dúvidas? nipteiapp@gmail.com"
    ),
    visa_travel_closed: t(
      "Seu caso de visto / viagem está encerrado — Immigration with NIPTEI",
      "Olá {{name}},\n\nSeu caso de visto / viagem de {{service}} já está encerrado. Seus documentos finais estão no seu portal.\n\nVer seus documentos: {{portalUrl}}\n\nDúvidas? Escreva para nipteiapp@gmail.com.\n\nImmigration with NIPTEI — https://immigration.niptei.com",
      "Olá {{name}}, seu caso de visto / viagem de {{service}} já está encerrado. Seus documentos finais estão aqui: {{portalUrl}} Dúvidas? nipteiapp@gmail.com"
    ),
  },
  zh: {
    quote_sent: t(
      "您的 Immigration with NIPTEI 报价已准备好 — {{service}}",
      "您好 {{name}}，\n\n您申请 {{service}} 的报价已准备好。服务费为 {{amount}}。请在您的门户中查看，并告诉我们是否继续。\n\n查看报价：{{portalUrl}}\n\n有问题？请写信至 nipteiapp@gmail.com。\n\nImmigration with NIPTEI — https://immigration.niptei.com",
      "您好 {{name}}，您申请 {{service}} 的 Immigration with NIPTEI 报价已准备好：{{amount}}。请在此查看：{{portalUrl}} 有问题？nipteiapp@gmail.com"
    ),
    payment_plan: t(
      "您的付款计划已设置 — 发票 {{invoiceId}}",
      "您好 {{name}}，\n\n您申请 {{service}} 的付款计划已设置。发票 {{invoiceId}} — {{amount}}。您可以在门户中付款或查看。\n\n查看付款计划：{{portalUrl}}\n\n有问题？请写信至 nipteiapp@gmail.com。\n\nImmigration with NIPTEI — https://immigration.niptei.com",
      "您好 {{name}}，您申请 {{service}} 的付款计划已设置。发票 {{invoiceId}} — {{amount}}。请在此付款或查看：{{portalUrl}} 有问题？nipteiapp@gmail.com"
    ),
    active_drafting: t(
      "我们正在为您起草 {{service}} — 仍缺少 {{missingCount}} 项材料",
      "您好 {{name}}，\n\n我们正在为您起草 {{service}}。仍缺少 {{missingCount}} 项材料。请在您的门户中上传。\n\n上传材料：{{portalUrl}}\n\n有问题？请写信至 nipteiapp@gmail.com。\n\nImmigration with NIPTEI — https://immigration.niptei.com",
      "您好 {{name}}，我们正在为您起草 {{service}}。仍缺少 {{missingCount}} 项材料 — 请在此上传：{{portalUrl}} 有问题？nipteiapp@gmail.com"
    ),
    at_uscis: t(
      "您的案件已提交至美国移民局 — 请查看您的门户",
      "您好 {{name}}，\n\n您申请 {{service}} 的案件已提交至美国移民局（USCIS）。收据号码：{{caseNumber}}。您可以在门户中查询进度。\n\n查看案件：{{portalUrl}}\n\n有问题？请写信至 nipteiapp@gmail.com。\n\nImmigration with NIPTEI — https://immigration.niptei.com",
      "您好 {{name}}，您申请 {{service}} 的案件已提交至美国移民局。收据：{{caseNumber}}。请在此查询：{{portalUrl}} 有问题？nipteiapp@gmail.com"
    ),
    nvc_processing: t(
      "您的案件已转至国家签证中心 — 请查看您的门户",
      "您好 {{name}}，\n\n您申请 {{service}} 的案件已转至国家签证中心（NVC）。案件号码：{{caseNumber}}，发票：{{invoiceId}}。请在门户中查看还缺少什么。\n\n查看案件：{{portalUrl}}\n\n有问题？请写信至 nipteiapp@gmail.com。\n\nImmigration with NIPTEI — https://immigration.niptei.com",
      "您好 {{name}}，您申请 {{service}} 的案件已转至国家签证中心。案件：{{caseNumber}}。请在此查看还缺少什么：{{portalUrl}} 有问题？nipteiapp@gmail.com"
    ),
    visa_travel_closed: t(
      "您的签证 / 旅行案件已结案 — Immigration with NIPTEI",
      "您好 {{name}}，\n\n您申请 {{service}} 的签证 / 旅行案件现已结案。您的最终文件已在门户中。\n\n查看文件：{{portalUrl}}\n\n有问题？请写信至 nipteiapp@gmail.com。\n\nImmigration with NIPTEI — https://immigration.niptei.com",
      "您好 {{name}}，您申请 {{service}} 的签证 / 旅行案件现已结案。您的最终文件在此：{{portalUrl}} 有问题？nipteiapp@gmail.com"
    ),
  },
  ar: {
    quote_sent: t(
      "عرض السعر الخاص بك من Immigration with NIPTEI جاهز — {{service}}",
      "مرحبًا {{name}}،\n\nعرض السعر الخاص بك لخدمة {{service}} جاهز. رسوم الخدمة هي {{amount}}. يرجى مراجعته في البوابة الخاصة بك وإخبارنا إذا كنت ترغب في المتابعة.\n\nعرض السعر: {{portalUrl}}\n\nهل لديك أسئلة؟ راسلنا على nipteiapp@gmail.com.\n\nImmigration with NIPTEI — https://immigration.niptei.com",
      "مرحبًا {{name}}، عرض السعر الخاص بك من Immigration with NIPTEI لخدمة {{service}} جاهز: {{amount}}. راجعه هنا: {{portalUrl}} هل لديك أسئلة؟ nipteiapp@gmail.com"
    ),
    payment_plan: t(
      "تم إعداد خطة الدفع الخاصة بك — الفاتورة {{invoiceId}}",
      "مرحبًا {{name}}،\n\nتم إعداد خطة الدفع الخاصة بك لخدمة {{service}}. الفاتورة {{invoiceId}} — {{amount}}. يمكنك دفعها أو عرضها في البوابة الخاصة بك.\n\nعرض الخطة: {{portalUrl}}\n\nهل لديك أسئلة؟ راسلنا على nipteiapp@gmail.com.\n\nImmigration with NIPTEI — https://immigration.niptei.com",
      "مرحبًا {{name}}، تم إعداد خطة الدفع الخاصة بك لخدمة {{service}}. الفاتورة {{invoiceId}} — {{amount}}. ادفع أو اعرض هنا: {{portalUrl}} هل لديك أسئلة؟ nipteiapp@gmail.com"
    ),
    active_drafting: t(
      "نقوم بإعداد {{service}} الخاصة بك — ما زال هناك {{missingCount}} مستندًا مفقودًا",
      "مرحبًا {{name}}،\n\nنقوم بإعداد {{service}} الخاصة بك. ما زال هناك {{missingCount}} مستندًا مفقودًا. يرجى تحميلها في البوابة الخاصة بك.\n\nتحميل المستندات: {{portalUrl}}\n\nهل لديك أسئلة؟ راسلنا على nipteiapp@gmail.com.\n\nImmigration with NIPTEI — https://immigration.niptei.com",
      "مرحبًا {{name}}، نقوم بإعداد {{service}} الخاصة بك. ما زال هناك {{missingCount}} مستندًا مفقودًا — يرجى تحميلها هنا: {{portalUrl}} هل لديك أسئلة؟ nipteiapp@gmail.com"
    ),
    at_uscis: t(
      "قضيتك الآن لدى دائرة خدمات المواطنة والهجرة الأمريكية — راجع البوابة الخاصة بك",
      "مرحبًا {{name}}،\n\nقضية {{service}} الخاصة بك أصبحت الآن لدى دائرة خدمات المواطنة والهجرة الأمريكية (USCIS). رقم الإيصال: {{caseNumber}}. يمكنك متابعة حالتها في البوابة الخاصة بك.\n\nعرض القضية: {{portalUrl}}\n\nهل لديك أسئلة؟ راسلنا على nipteiapp@gmail.com.\n\nImmigration with NIPTEI — https://immigration.niptei.com",
      "مرحبًا {{name}}، قضية {{service}} الخاصة بك أصبحت الآن لدى USCIS. الإيصال: {{caseNumber}}. تابعها هنا: {{portalUrl}} هل لديك أسئلة؟ nipteiapp@gmail.com"
    ),
    nvc_processing: t(
      "قضيتك الآن لدى المركز الوطني للتأشيرات — راجع البوابة الخاصة بك",
      "مرحبًا {{name}}،\n\nقضية {{service}} الخاصة بك أصبحت الآن لدى المركز الوطني للتأشيرات (NVC). رقم القضية: {{caseNumber}}، الفاتورة: {{invoiceId}}. راجع البوابة الخاصة بك لمعرفة ما هو مطلوب.\n\nعرض القضية: {{portalUrl}}\n\nهل لديك أسئلة؟ راسلنا على nipteiapp@gmail.com.\n\nImmigration with NIPTEI — https://immigration.niptei.com",
      "مرحبًا {{name}}، قضية {{service}} الخاصة بك أصبحت الآن لدى المركز الوطني للتأشيرات. القضية: {{caseNumber}}. اعرف ما هو مطلوب هنا: {{portalUrl}} هل لديك أسئلة؟ nipteiapp@gmail.com"
    ),
    visa_travel_closed: t(
      "تم إغلاق قضية التأشيرة / السفر الخاصة بك — Immigration with NIPTEI",
      "مرحبًا {{name}}،\n\nتم إغلاق قضية التأشيرة / السفر {{service}} الخاصة بك الآن. مستنداتك النهائية موجودة في البوابة الخاصة بك.\n\nعرض المستندات: {{portalUrl}}\n\nهل لديك أسئلة؟ راسلنا على nipteiapp@gmail.com.\n\nImmigration with NIPTEI — https://immigration.niptei.com",
      "مرحبًا {{name}}، تم إغلاق قضية التأشيرة / السفر {{service}} الخاصة بك الآن. مستنداتك النهائية هنا: {{portalUrl}} هل لديك أسئلة؟ nipteiapp@gmail.com"
    ),
  },
};

// Placeholders (rendered by renderTemplate):
//   {{name}} {{service}} {{amount}} {{invoiceId}} {{caseNumber}}
//   {{missingCount}} {{missingDocument}} {{portalUrl}}

// ---------------------------------------------------------------------------
// Missing-document nudge templates — one per language, for the 48h nudge
// (src/lib/nudges.ts, NUDGE_INTERVAL_HOURS = 48). A nudge names the ONE
// document that is still missing ({{missingDocument}}), so the client
// knows exactly what to upload — the stage template active_drafting only
// gives a count. Sent (once Twilio / Resend are connected) via
// /api/reminders; until then the route returns 501 and sends nothing.
// FR/PT/ZH/AR below are agent translations of the same EN text — they
// MUST be reviewed by the founder / a native speaker before any live send,
// same as the stage templates above. NO A-Number appears in any template.
// ---------------------------------------------------------------------------
export const MISSING_DOCUMENT_NUDGE_TEMPLATES: Record<LanguageCode, NotificationTemplate> = {
  en: t(
    "Still missing: {{missingDocument}} — Immigration with NIPTEI",
    "Hello {{name}},\n\nWe are still missing one document for your {{service}}: {{missingDocument}}. Please upload it in your portal so we can keep preparing your case.\n\nUpload it here: {{portalUrl}}\n\nQuestions? Write to nipteiapp@gmail.com.\n\nImmigration with NIPTEI — https://immigration.niptei.com",
    "Hello {{name}}, we are still missing {{missingDocument}} for your {{service}}. Please upload it here: {{portalUrl}} Questions? nipteiapp@gmail.com"
  ),
  es: t(
    "Todavía falta: {{missingDocument}} — Immigration with NIPTEI",
    "Hola {{name}},\n\nTodavía falta un documento para su {{service}}: {{missingDocument}}. Por favor, súbalo en su portal para que podamos seguir preparando su caso.\n\nSúbalo aquí: {{portalUrl}}\n\n¿Preguntas? Escríbanos a nipteiapp@gmail.com.\n\nImmigration with NIPTEI — https://immigration.niptei.com",
    "Hola {{name}}, todavía falta {{missingDocument}} para su {{service}}. Por favor, súbalo aquí: {{portalUrl}} ¿Preguntas? nipteiapp@gmail.com"
  ),
  ht: t(
    "Dokiman sa a manke toujou: {{missingDocument}} — Immigration with NIPTEI",
    "Bonjou {{name}},\n\nGen yon dokiman ki manke toujou pou {{service}} ou a: {{missingDocument}}. Tanpri mete li nan pòtal ou a pou nou ka kontinye prepare dosye ou a.\n\nMete li isit la: {{portalUrl}}\n\nKesyon? Ekri nou nan nipteiapp@gmail.com.\n\nImmigration with NIPTEI — https://immigration.niptei.com",
    "Bonjou {{name}}, dokiman {{missingDocument}} manke toujou pou {{service}} ou a. Tanpri mete li isit la: {{portalUrl}} Kesyon? nipteiapp@gmail.com"
  ),
  fr: t(
    "Il manque toujours : {{missingDocument}} — Immigration with NIPTEI",
    "Bonjour {{name}},\n\nIl manque toujours un document pour votre {{service}} : {{missingDocument}}. Veuillez le téléverser dans votre portail pour que nous puissions continuer à préparer votre dossier.\n\nTéléversez-le ici : {{portalUrl}}\n\nDes questions ? Écrivez-nous à nipteiapp@gmail.com.\n\nImmigration with NIPTEI — https://immigration.niptei.com",
    "Bonjour {{name}}, il manque toujours {{missingDocument}} pour votre {{service}}. Veuillez le téléverser ici : {{portalUrl}} Questions ? nipteiapp@gmail.com"
  ),
  pt: t(
    "Ainda falta: {{missingDocument}} — Immigration with NIPTEI",
    "Olá {{name}},\n\nAinda falta um documento para seu {{service}}: {{missingDocument}}. Por favor, envie-o no seu portal para que possamos continuar preparando seu caso.\n\nEnvie-o aqui: {{portalUrl}}\n\nDúvidas? Escreva para nipteiapp@gmail.com.\n\nImmigration with NIPTEI — https://immigration.niptei.com",
    "Olá {{name}}, ainda falta {{missingDocument}} para seu {{service}}. Por favor, envie-o aqui: {{portalUrl}} Dúvidas? nipteiapp@gmail.com"
  ),
  zh: t(
    "仍缺少：{{missingDocument}} — Immigration with NIPTEI",
    "您好 {{name}}，\n\n您申请 {{service}} 仍缺少一份材料：{{missingDocument}}。请在您的门户中上传，以便我们继续为您准备案件。\n\n请在此上传：{{portalUrl}}\n\n有问题？请写信至 nipteiapp@gmail.com。\n\nImmigration with NIPTEI — https://immigration.niptei.com",
    "您好 {{name}}，您申请 {{service}} 仍缺少 {{missingDocument}}。请在此上传：{{portalUrl}} 有问题？nipteiapp@gmail.com"
  ),
  ar: t(
    "ما زال مفقودًا: {{missingDocument}} — Immigration with NIPTEI",
    "مرحبًا {{name}}،\n\nما زال هناك مستند واحد مفقود لقضية {{service}} الخاصة بك: {{missingDocument}}. يرجى تحميله في البوابة الخاصة بك حتى نتمكن من مواصلة إعداد قضيتك.\n\nحمّله هنا: {{portalUrl}}\n\nهل لديك أسئلة؟ راسلنا على nipteiapp@gmail.com.\n\nImmigration with NIPTEI — https://immigration.niptei.com",
    "مرحبًا {{name}}، ما زال {{missingDocument}} مفقودًا لقضية {{service}} الخاصة بك. يرجى تحميله هنا: {{portalUrl}} هل لديك أسئلة؟ nipteiapp@gmail.com"
  ),
};

/** Render the missing-document nudge for one recipient, in their language. */
export function renderMissingDocumentNudge(
  language: LanguageCode,
  vars: TemplateVars
): NotificationTemplate {
  const tpl =
    MISSING_DOCUMENT_NUDGE_TEMPLATES[language] ?? MISSING_DOCUMENT_NUDGE_TEMPLATES.en;
  const fullVars: TemplateVars = { portalUrl: PORTAL_URL, ...vars };
  return {
    emailSubject: renderTemplateText(tpl.emailSubject, fullVars),
    emailBody: renderTemplateText(tpl.emailBody, fullVars),
    smsText: renderTemplateText(tpl.smsText, fullVars),
  };
}

export type TemplateVars = {
  name?: string;
  service?: string;
  amount?: string;
  invoiceId?: string;
  caseNumber?: string;
  missingCount?: string | number;
  /** Name of the one missing document, for the missing-document nudge. */
  missingDocument?: string;
  portalUrl?: string;
};

const PLACEHOLDER_KEYS = [
  "name",
  "service",
  "amount",
  "invoiceId",
  "caseNumber",
  "missingCount",
  "missingDocument",
  "portalUrl",
] as const;

/** Fill {{placeholders}} in a template string. Missing values render as "". */
export function renderTemplateText(text: string, vars: TemplateVars): string {
  let out = text;
  for (const key of PLACEHOLDER_KEYS) {
    const value = vars[key];
    out = out.split(`{{${key}}}`).join(value === undefined ? "" : String(value));
  }
  return out;
}

export function getNotificationTemplate(
  stage: NotificationStageKey,
  language: LanguageCode
): NotificationTemplate {
  return NOTIFICATION_TEMPLATES[language]?.[stage] ?? NOTIFICATION_TEMPLATES.en[stage];
}

/** Render all three fields of a stage template for one recipient. */
export function renderNotification(
  stage: NotificationStageKey,
  language: LanguageCode,
  vars: TemplateVars
): NotificationTemplate {
  const tpl = getNotificationTemplate(stage, language);
  const fullVars: TemplateVars = { portalUrl: PORTAL_URL, ...vars };
  return {
    emailSubject: renderTemplateText(tpl.emailSubject, fullVars),
    emailBody: renderTemplateText(tpl.emailBody, fullVars),
    smsText: renderTemplateText(tpl.smsText, fullVars),
  };
}
