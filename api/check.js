export const config = {
  runtime: 'edge',
};

async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default async function handler(req) {

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405
    });
  }

  try {

    const body = await req.json();
    const { transactionId } = body;

    if (!transactionId) {
      return new Response(JSON.stringify({ error: "Missing transactionId" }), {
        status: 400
      });
    }

    const SYNC_PUBLIC_KEY = process.env.SYNC_PUBLIC_KEY;
    const SYNC_PRIVATE_KEY = process.env.SYNC_PRIVATE_KEY;
    const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;

    if (!SYNC_PUBLIC_KEY  !META_ACCESS_TOKEN) {
      return new Response(JSON.stringify({ error: "Missing ENV" }), {
        status: 500
      });
    }

    const encodedAuth = btoa(${SYNC_PUBLIC_KEY}:${SYNC_PRIVATE_KEY});

    const syncResponse = await fetch(
      https://api.syncpay.pro/s1/getTransaction/api/getTransactionStatus.php?id_transaction=${transactionId},
      {
        headers: {
          "Authorization": Basic ${encodedAuth}
        }
      }
    );

    const syncData = await syncResponse.json();

    if (syncData.situacao !== "APROVADO") {
      return new Response(JSON.stringify({ status: "NOT_APPROVED" }), {
        status: 200
      });
    }

    const hashedEmail = await sha256(syncData.email.trim().toLowerCase());

    const metaPayload = {
      data: [{
        event_name: "Purchase",
        event_time: Math.floor(Date.now() / 1000),
        action_source: "website",
        user_data: {
          em: hashedEmail
        },
        custom_data: {
          currency: "GBP",
          value: parseFloat(syncData.valor_bruto)
        }
      }]
    };

    const metaResponse = await fetch(
      https://graph.facebook.com/v18.0/1303581471201526/events?access_token=${META_ACCESS_TOKEN},
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(metaPayload)
      }
    );

    const metaResult = await metaResponse.json();

    return new Response(JSON.stringify({
      status: "PURCHASE_SENT",
      meta: metaResult
    }), { status: 200 });

  } catch (err) {

    return new Response(JSON.stringify({
      error: err.message
    }), { status: 500 });

  }
}
