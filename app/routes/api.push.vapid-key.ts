import { json } from "@remix-run/node";

export async function loader() {
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  
  if (!vapidPublicKey) {
    throw new Response("VAPID public key not configured", { status: 500 });
  }

  return json({ publicKey: vapidPublicKey });
}