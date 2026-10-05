import { CERT_PATH, SUBSCRIBE_PATH, isSnsUrl, parseSnsMessage, verifySnsSignature } from "@/lib/sns"
import { saveStreetworksEvent } from "@/lib/streetworks-store"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// DfT Street Manager open data: AWS SNS posts permit and works events here.
// The first post is a SubscriptionConfirmation, confirmed by calling its
// SubscribeURL; after that each Notification carries one Street Manager event.

const MAX_BODY = 256 * 1024
const certificates = new Map<string, Promise<string>>()

export function GET() {
  return Response.json({ ok: true, service: "SmartLDN Street Manager receiver", accepts: "AWS SNS HTTPS POST" })
}

export async function POST(request: Request) {
  const body = await request.text()
  if (body.length > MAX_BODY) return Response.json({ ok: false, error: "Message too large" }, { status: 413 })
  const message = parseSnsMessage(body)
  if (!message) return Response.json({ ok: false, error: "Not an SNS message" }, { status: 400 })
  const declared = request.headers.get("x-amz-sns-message-type")
  if (declared && declared !== message.Type) return Response.json({ ok: false, error: "Message type mismatch" }, { status: 400 })
  if (!isSnsUrl(message.SigningCertURL, CERT_PATH)) return Response.json({ ok: false, error: "Untrusted signing certificate" }, { status: 403 })

  const certificate = await signingCertificate(message.SigningCertURL).catch(() => null)
  if (!certificate || !verifySnsSignature(message, certificate)) {
    return Response.json({ ok: false, error: "Signature check failed" }, { status: 403 })
  }

  if (message.Type === "SubscriptionConfirmation") {
    const subscribe = message.SubscribeURL ?? ""
    if (!isSnsUrl(subscribe, SUBSCRIBE_PATH) || new URL(subscribe).searchParams.get("Action") !== "ConfirmSubscription") {
      return Response.json({ ok: false, error: "Untrusted subscribe address" }, { status: 403 })
    }
    const confirmed = await fetch(subscribe, { signal: AbortSignal.timeout(15_000) }).then((response) => response.ok, () => false)
    await saveStreetworksEvent({ type: message.Type, messageId: message.MessageId, topicArn: message.TopicArn, confirmed })
    console.info(`[streetworks] subscription to ${message.TopicArn} ${confirmed ? "confirmed" : "NOT confirmed"}`)
    return Response.json({ ok: confirmed }, { status: confirmed ? 200 : 502 })
  }

  let event: unknown = message.Message
  try {
    event = JSON.parse(message.Message)
  } catch {
    // Kept as text when the payload is not JSON.
  }
  await saveStreetworksEvent({ type: message.Type, messageId: message.MessageId, topicArn: message.TopicArn, subject: message.Subject ?? null, event })
  return Response.json({ ok: true })
}

function signingCertificate(url: string): Promise<string> {
  let pending = certificates.get(url)
  if (!pending) {
    pending = fetch(url, { signal: AbortSignal.timeout(10_000) }).then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status} for signing certificate`)
      return response.text()
    })
    pending.catch(() => certificates.delete(url))
    certificates.set(url, pending)
  }
  return pending
}
