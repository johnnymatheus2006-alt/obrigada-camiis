import crypto from 'crypto';

export default async function handler(req, res) {

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {

    const { transactionId } = req.body;

    if (!transactionId) {
      return res.status(400).json({ error: 'Missing transactionId' });
    }

    const SYNC_PUBLIC_KEY = process.env.SYNC_PUBLIC_KEY;
    const SYNC_PRIVATE_KEY = process.env.SYNC_PRIVATE_KEY;
    const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
    const PIXEL_ID = '1303581471201526';

    if (!SYNC_PUBLIC_KEY  !META_ACCESS_TOKEN) {
      return res.status(500).json({ error: 'Missing environment variables' });
    }

    // 🔐 Basic Auth (public:private)
    const encodedAuth = Buffer
      .from(${SYNC_PUBLIC_KEY}:${SYNC_PRIVATE_KEY})
      .toString('base64');

    // 🔎 Consulta Sync
    const syncResponse = await fetch(
      https://api.syncpay.pro/s1/getTransaction/api/getTransactionStatus.php?id_transaction=${transactionId},
      {
        method: 'GET',
        headers: {
          'Authorization': Basic ${encodedAuth}
        }
      }
    );

    const syncData = await syncResponse.json();

    if (!syncData || syncData.situacao !== "APROVADO") {
      return res.status(200).json({ status: "NOT_APPROVED" });
    }

    // 📧 Hash email
    const hashedEmail = crypto
      .createHash('sha256')
      .update(syncData.email.trim().toLowerCase())
      .digest('hex');

    // 📡 Envia CAPI
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
      https://graph.facebook.com/v18.0/${PIXEL_ID}/events?access_token=${META_ACCESS_TOKEN},
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metaPayload)
      }
    );

    const metaResult = await metaResponse.json();

    return res.status(200).json({
      status: "PURCHASE_SENT",
      meta: metaResult
    });

  } catch (error) {
    return res.status(500).json({
      error: error.message
    });
  }
}
