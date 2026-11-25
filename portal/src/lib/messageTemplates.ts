// Quick message templates — all 7 languages, for the Unified Thread.
// Languages: en, es, ht (Kreyòl Ayisyen), fr, pt, zh, ar (RTL).
// These are short UI strings only — NOT certified translations, and NOT
// legal advice. Any template filled in with a price, date, or deadline
// ({amount}, {date}, {deadline}) MUST be human-confirmed before sending:
// see src/lib/translate.ts needsHumanConfirmation(). Placeholders are
// never translated away: {document}, {amount}, {date}, {deadline},
// {link} survive in every language.
import type { LanguageCode } from "./i18n";

export type TemplateId =
  | "request_missing_document"
  | "nvc_fee_reminder"
  | "booking_link"
  | "payment_link"
  | "esign_ready"
  | "rfe_deadline_warning";

export interface MessageTemplate {
  id: TemplateId;
  label: string;
  /** True when the template carries a price/date/deadline placeholder. */
  needsHumanConfirmation: boolean;
  text: Record<LanguageCode, string>;
}

export const MESSAGE_TEMPLATES: MessageTemplate[] = [
  {
    id: "request_missing_document",
    label: "Request Missing Document",
    needsHumanConfirmation: false,
    text: {
      en: "Hello — we still need one document from you: {document}. Please upload it in your portal, or reply here. Thank you.",
      es: "Hola: todavía necesitamos un documento de usted: {document}. Por favor, súbalo en su portal o responda aquí. Gracias.",
      ht: "Bonjou — nou toujou bezwen yon dokiman nan men ou: {document}. Tanpri mete li nan pòtay ou, oswa reponn isit la. Mèsi.",
      fr: "Bonjour — il nous manque encore un document de votre part : {document}. Veuillez le téléverser dans votre portail, ou répondez ici. Merci.",
      pt: "Olá — ainda precisamos de um documento seu: {document}. Por favor, envie-o no seu portal ou responda aqui. Obrigado.",
      zh: "您好——我们还需要您提供一份文件：{document}。请在您的门户中上传，或在此回复。谢谢。",
      ar: "مرحبًا — ما زلنا نحتاج إلى مستند واحد منك: {document}. يُرجى تحميله في بوابتك، أو الرد هنا. شكرًا لك.",
    },
  },
  {
    id: "nvc_fee_reminder",
    label: "NVC Fee Reminder",
    needsHumanConfirmation: true,
    text: {
      en: "Reminder: your NVC fee of {amount} is due by {date}. Pay it in CEAC (link in your portal). Government fees are paid separately to the U.S. Department of State — never mixed with our preparation fee.",
      es: "Recordatorio: su tarifa del NVC de {amount} vence el {date}. Páguela en CEAC (enlace en su portal). Las tarifas del gobierno se pagan por separado al Departamento de Estado de EE. UU.",
      ht: "Rapèl: frè NVC ou a ki se {amount} dwe peye anvan {date}. Peye li nan CEAC (lyen an nan pòtay ou). Frè gouvènman yo peye apa bay Depatman Deta Ameriken an.",
      fr: "Rappel : vos frais NVC de {amount} sont dus avant le {date}. Payez-les dans le CEAC (lien dans votre portail). Les frais gouvernementaux se paient séparément au Département d'État américain.",
      pt: "Lembrete: sua taxa do NVC de {amount} vence em {date}. Pague-a no CEAC (link no seu portal). As taxas do governo são pagas separadamente ao Departamento de Estado dos EUA.",
      zh: "提醒：您的 NVC 费用 {amount} 须在 {date} 之前缴纳。请在 CEAC 中缴纳（链接在您的门户中）。政府费用需单独缴纳给美国国务院。",
      ar: "تذكير: رسوم المركز الوطني للتأشيرات (NVC) البالغة {amount} مستحقة بحلول {date}. ادفعها في CEAC (الرابط في بوابتك). تُدفع الرسوم الحكومية بشكل منفصل إلى وزارة الخارجية الأمريكية.",
    },
  },
  {
    id: "booking_link",
    label: "Booking Link",
    needsHumanConfirmation: false,
    text: {
      en: "Here is your booking link: {link}. Please choose a time that works for you. If the link does not work, reply here and we will help.",
      es: "Aquí está su enlace para reservar: {link}. Elija una hora que le convenga. Si el enlace no funciona, responda aquí y le ayudaremos.",
      ht: "Men lyen pou pran randevou ou a: {link}. Tanpri chwazi yon lè ki bon pou ou. Si lyen an pa mache, reponn isit la epi n ap ede ou.",
      fr: "Voici votre lien de réservation : {link}. Veuillez choisir un horaire qui vous convient. Si le lien ne fonctionne pas, répondez ici et nous vous aiderons.",
      pt: "Aqui está o seu link de agendamento: {link}. Escolha um horário que funcione para você. Se o link não funcionar, responda aqui e ajudaremos.",
      zh: "这是您的预约链接：{link}。请选择一个适合您的时间。如果链接无法使用，请在此回复，我们会协助您。",
      ar: "إليك رابط الحجز الخاص بك: {link}. يُرجى اختيار وقت يناسبك. إذا لم يعمل الرابط، فأجب هنا وسنساعدك.",
    },
  },
  {
    id: "payment_link",
    label: "Payment Link",
    needsHumanConfirmation: true,
    text: {
      en: "Here is your payment link: {link}. The amount is {amount}. This is only our preparation fee — the USCIS government fee is separate and is paid directly to the U.S. Department of Homeland Security.",
      es: "Aquí está su enlace de pago: {link}. El monto es {amount}. Esto es solo nuestra tarifa de preparación; la tarifa del gobierno de USCIS es aparte y se paga directamente al Departamento de Seguridad Nacional de EE. UU.",
      ht: "Men lyen pou peye ou a: {link}. Montan an se {amount}. Sa se sèlman frè preparasyon nou an — frè gouvènman USCIS la apa epi li peye dirèkteman bay Depatman Sekirite Nasyonal Ameriken an.",
      fr: "Voici votre lien de paiement : {link}. Le montant est de {amount}. Il s'agit uniquement de nos frais de préparation — les frais gouvernementaux de l'USCIS sont séparés et se paient directement au Département américain de la Sécurité intérieure.",
      pt: "Aqui está o seu link de pagamento: {link}. O valor é {amount}. Esta é apenas a nossa taxa de preparação — a taxa governamental do USCIS é separada e paga diretamente ao Departamento de Segurança Interna dos EUA.",
      zh: "这是您的付款链接：{link}。金额为 {amount}。这仅是我们的准备费用——USCIS 政府费用是分开的，需直接缴纳给美国国土安全部。",
      ar: "إليك رابط الدفع الخاص بك: {link}. المبلغ هو {amount}. هذه رسوم التحضير الخاصة بنا فقط — أما رسوم حكومة USCIS فهي منفصلة وتُدفع مباشرة إلى وزارة الأمن الداخلي الأمريكية.",
    },
  },
  {
    id: "esign_ready",
    label: "E-Sign Ready",
    needsHumanConfirmation: false,
    text: {
      en: "Your packet is ready to sign. Please open your portal, read every page carefully, and e-sign only if every name, date, and address is correct. Do not sign a draft with a mistake in it.",
      es: "Su paquete está listo para firmar. Abra su portal, lea cada página con cuidado y firme electrónicamente solo si cada nombre, fecha y dirección son correctos. No firme un borrador con un error.",
      ht: "Pakè ou a pare pou siyen. Tanpri louvri pòtay ou, li chak paj ak anpil atansyon, epi siyen elektwonikman sèlman si chak non, dat, ak adrès kòrèk. Pa siyen yon bouyon ki gen yon erè ladan li.",
      fr: "Votre dossier est prêt à signer. Ouvrez votre portail, lisez chaque page attentivement et signez électroniquement uniquement si chaque nom, date et adresse est correct. Ne signez pas un brouillon qui contient une erreur.",
      pt: "Seu pacote está pronto para assinar. Abra seu portal, leia cada página com atenção e assine eletronicamente somente se cada nome, data e endereço estiver correto. Não assine um rascunho com erro.",
      zh: "您的文件包已准备好签署。请打开您的门户，仔细阅读每一页，仅在每个姓名、日期和地址都正确时进行电子签署。请勿签署有错误的文件草稿。",
      ar: "حزمتك جاهزة للتوقيع. يُرجى فتح بوابتك وقراءة كل صفحة بعناية، والتوقيع إلكترونيًا فقط إذا كان كل اسم وتاريخ وعنوان صحيحًا. لا توقّع على مسودة بها خطأ.",
    },
  },
  {
    id: "rfe_deadline_warning",
    label: "RFE Deadline Warning",
    needsHumanConfirmation: true,
    text: {
      en: "Important: USCIS asked for more evidence (RFE). Your reply is due by {deadline}. Please send us the documents listed in your portal before that date — a late reply can cause a denial.",
      es: "Importante: USCIS pidió más evidencia (RFE). Su respuesta vence el {deadline}. Envíenos los documentos indicados en su portal antes de esa fecha; una respuesta tardía puede causar una negación.",
      ht: "Enpòtan: USCIS mande plis prèv (RFE). Repons ou a dwe rive anvan {deadline}. Tanpri voye dokiman ki nan pòtay ou yo ban nou anvan dat sa a — yon repons an reta ka lakòz yon refi.",
      fr: "Important : l'USCIS a demandé des preuves supplémentaires (RFE). Votre réponse est due avant le {deadline}. Envoyez-nous les documents indiqués dans votre portail avant cette date — une réponse tardive peut entraîner un refus.",
      pt: "Importante: o USCIS pediu mais evidências (RFE). Sua resposta vence em {deadline}. Envie-nos os documentos listados no seu portal antes dessa data — uma resposta atrasada pode causar uma negação.",
      zh: "重要提示：USCIS 要求提供更多证据（RFE）。您的回复须在 {deadline} 之前提交。请在此日期之前将门户中列出的文件发送给我们——逾期回复可能导致拒绝。",
      ar: "مهم: طلبت USCIS أدلة إضافية (RFE). يجب تقديم ردك بحلول {deadline}. يُرجى إرسال المستندات المدرجة في بوابتك قبل ذلك التاريخ — فالرد المتأخر قد يؤدي إلى الرفض.",
    },
  },
];

/** Fill {document} / {amount} / {date} / {deadline} / {link} placeholders.
 *  Placeholders are never translated; values are inserted verbatim so a
 *  number, date, or price is never altered by translation. */
export function fillTemplate(
  template: MessageTemplate,
  language: LanguageCode,
  values: Record<string, string>
): string {
  let out = template.text[language];
  for (const [key, value] of Object.entries(values)) {
    out = out.split(`{${key}}`).join(value);
  }
  return out;
}
