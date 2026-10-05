import { createVerify } from "node:crypto"

// AWS SNS HTTPS delivery, as used by the DfT Street Manager open data feed.
// Every message is signed by SNS; the signing certificate must come from an
// sns.<region>.amazonaws.com address, or the message is refused.

export type SnsMessage = {
  Type: "SubscriptionConfirmation" | "Notification" | "UnsubscribeConfirmation"
  MessageId: string
  TopicArn: string
  Message: string
  Timestamp: string
  SignatureVersion: string
  Signature: string
  SigningCertURL: string
  Subject?: string
  SubscribeURL?: string
  Token?: string
}

const TYPES = new Set(["SubscriptionConfirmation", "Notification", "UnsubscribeConfirmation"])

export function parseSnsMessage(body: string): SnsMessage | null {
  let value: unknown
  try {
    value = JSON.parse(body)
  } catch {
    return null
  }
  if (typeof value !== "object" || value === null) return null
  const row = value as Record<string, unknown>
  const text = (key: string) => (typeof row[key] === "string" ? (row[key] as string) : null)
  const type = text("Type")
  if (!type || !TYPES.has(type)) return null
  const required = ["MessageId", "TopicArn", "Message", "Timestamp", "SignatureVersion", "Signature", "SigningCertURL"]
  if (required.some((key) => text(key) == null)) return null
  return {
    Type: type as SnsMessage["Type"],
    MessageId: text("MessageId") ?? "",
    TopicArn: text("TopicArn") ?? "",
    Message: text("Message") ?? "",
    Timestamp: text("Timestamp") ?? "",
    SignatureVersion: text("SignatureVersion") ?? "",
    Signature: text("Signature") ?? "",
    SigningCertURL: text("SigningCertURL") ?? "",
    ...(text("Subject") != null ? { Subject: text("Subject") ?? "" } : {}),
    ...(text("SubscribeURL") != null ? { SubscribeURL: text("SubscribeURL") ?? "" } : {}),
    ...(text("Token") != null ? { Token: text("Token") ?? "" } : {}),
  }
}

// Only SNS's own HTTPS hosts may sign messages or receive the confirmation call.
export function isSnsUrl(value: string, pathPattern: RegExp): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "https:" && /^sns\.[a-z0-9-]+\.amazonaws\.com(\.cn)?$/.test(url.hostname) && pathPattern.test(url.pathname)
  } catch {
    return false
  }
}

export const CERT_PATH = /^\/SimpleNotificationService-[a-zA-Z0-9]+\.pem$/
export const SUBSCRIBE_PATH = /^\/$/

// The fields SNS signs, in the order AWS documents for each message type.
export function stringToSign(message: SnsMessage): string {
  const keys: (keyof SnsMessage)[] =
    message.Type === "Notification"
      ? ["Message", "MessageId", "Subject", "Timestamp", "TopicArn", "Type"]
      : ["Message", "MessageId", "SubscribeURL", "Timestamp", "Token", "TopicArn", "Type"]
  let out = ""
  for (const key of keys) {
    const value = message[key]
    if (value == null) continue
    out += `${key}\n${value}\n`
  }
  return out
}

export function verifySnsSignature(message: SnsMessage, certificatePem: string): boolean {
  const algorithm = message.SignatureVersion === "2" ? "RSA-SHA256" : message.SignatureVersion === "1" ? "RSA-SHA1" : null
  if (!algorithm) return false
  try {
    const verifier = createVerify(algorithm)
    verifier.update(stringToSign(message), "utf8")
    return verifier.verify(certificatePem, message.Signature, "base64")
  } catch {
    return false
  }
}
