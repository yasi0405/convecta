import type { CustomMessageTriggerHandler } from "aws-lambda";

const BRAND_BG = "#0F172A";
const BRAND_TEXT = "#FFFFFF";
const BTN_BG = "#22C55E";
const BTN_TEXT = "#0B1220";

type TemplateInput = {
  heading: string;
  cta: string;
  code: string;
  link?: string;
};

const buildHtml = ({ heading, cta, code, link }: TemplateInput) => {
  const buttonBlock = link
    ? `<tr><td align="center" style="padding-bottom:32px;">
      <a href="${link}" style="background:${BTN_BG};color:${BTN_TEXT};text-decoration:none;border-radius:8px;padding:12px 20px;display:inline-block;font-weight:700">${cta}</a>
    </td></tr>`
    : "";

  return `
<!doctype html><html><body style="margin:0;padding:0;background:${BRAND_BG};">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${BRAND_BG};">
  <tr>
    <td align="center" style="padding:40px 16px;">
      <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="background:${BRAND_BG};color:${BRAND_TEXT};font-family:Arial,Helvetica,sans-serif;">
        <tr><td align="center" style="padding-bottom:16px;">
          <img src="https://your-cdn/logo.png" alt="Convecta" height="40" style="display:block;">
        </td></tr>
        <tr><td style="font-size:24px;font-weight:700;padding-bottom:8px;">${heading}</td></tr>
        <tr><td style="font-size:14px;opacity:.9;padding-bottom:24px;">Entre le code ci-dessous ou clique sur le bouton.</td></tr>
        <tr><td align="center" style="font-size:28px;letter-spacing:4px;font-weight:700;padding:12px 0 24px 0;">${code}</td></tr>
        ${buttonBlock}
        <tr><td style="font-size:12px;opacity:.7">Si tu n’es pas à l’origine de cette demande, ignore ce message.</td></tr>
        <tr><td style="font-size:12px;opacity:.7">PARRAINAGE</td></tr>
      </table>
    </td>
  </tr>
</table>
</body></html>`;
};

export const handler: CustomMessageTriggerHandler = async (event) => {
  const { triggerSource } = event;
  const code = event.request.codeParameter ?? "";
  const link = event.request.linkParameter;

  if (triggerSource === "CustomMessage_SignUp" || triggerSource === "CustomMessage_ResendCode") {
    const html = buildHtml({
      heading: "Confirme ton adresse",
      cta: "Confirmer mon compte",
      code,
      link,
    });
    event.response.emailSubject = "Bienvenue • Confirme ton adresse";
    event.response.emailMessage = html;
    event.response.emailMessageByLink = html; // handle code + link based flows
    return event;
  }

  if (triggerSource === "CustomMessage_ForgotPassword") {
    const html = buildHtml({
      heading: "Réinitialise ton mot de passe",
      cta: "Changer mon mot de passe",
      code,
      link,
    });
    event.response.emailSubject = "Réinitialise ton mot de passe";
    event.response.emailMessage = html;
    event.response.emailMessageByLink = html;
    return event;
  }

  return event;
};
