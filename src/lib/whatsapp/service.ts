type WhatsAppSendResult =
  | {
      ok: true;
      skipped: false;
    }
  | {
      ok: true;
      skipped: true;
      reason: string;
    }
  | {
      ok: false;
      skipped: false;
      reason: string;
    };

export async function sendWhatsAppText(to: string, body: string): Promise<WhatsAppSendResult> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!accessToken || !phoneNumberId) {
    return {
      ok: true,
      skipped: true,
      reason: "WhatsApp credential belum dikonfigurasi."
    };
  }

  const response = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: {
        preview_url: false,
        body
      }
    })
  });

  if (!response.ok) {
    return {
      ok: false,
      skipped: false,
      reason: await response.text()
    };
  }

  return {
    ok: true,
    skipped: false
  };
}
