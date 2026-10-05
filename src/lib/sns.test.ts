import assert from "node:assert/strict"
import { createSign, generateKeyPairSync } from "node:crypto"
import { CERT_PATH, SUBSCRIBE_PATH, isSnsUrl, parseSnsMessage, stringToSign, verifySnsSignature, type SnsMessage } from "./sns.ts"

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 })
const publicPem = publicKey.export({ type: "spki", format: "pem" }).toString()

function signed(fields: Omit<SnsMessage, "Signature" | "SignatureVersion" | "SigningCertURL">, version = "2"): SnsMessage {
  const message: SnsMessage = { ...fields, SignatureVersion: version, Signature: "", SigningCertURL: "https://sns.eu-west-2.amazonaws.com/SimpleNotificationService-abc123.pem" }
  const signer = createSign(version === "2" ? "RSA-SHA256" : "RSA-SHA1")
  signer.update(stringToSign(message))
  return { ...message, Signature: signer.sign(privateKey, "base64") }
}

// --- A subscription confirmation, as Street Manager's SNS topic sends it ---
const confirmation = signed({
  Type: "SubscriptionConfirmation",
  MessageId: "165545c9-2a5c-472c-8df2-7ff2be2b3b1b",
  Token: "2336412f37fb687f5d51e6e2425f004a",
  TopicArn: "arn:aws:sns:eu-west-2:123456789012:street-manager-open-data",
  Message: "You have chosen to subscribe to the topic.",
  SubscribeURL: "https://sns.eu-west-2.amazonaws.com/?Action=ConfirmSubscription&TopicArn=arn:aws:sns:eu-west-2:123456789012:street-manager-open-data&Token=2336412f37fb687f5d51e6e2425f004a",
  Timestamp: "2026-10-05T12:00:00.000Z",
})
assert.equal(stringToSign(confirmation).startsWith("Message\nYou have chosen"), true)
assert.match(stringToSign(confirmation), /\nSubscribeURL\n[^\n]*\nTimestamp\n[^\n]*\nToken\n[^\n]*\nTopicArn\n[^\n]*\nType\nSubscriptionConfirmation\n$/)
assert.equal(verifySnsSignature(confirmation, publicPem), true)
assert.equal(verifySnsSignature({ ...confirmation, Message: "tampered" }, publicPem), false)
assert.equal(verifySnsSignature({ ...confirmation, SignatureVersion: "3" }, publicPem), false)

// --- A notification without a Subject leaves Subject out of the signed text ---
const notification = signed({
  Type: "Notification",
  MessageId: "a1b2",
  TopicArn: "arn:aws:sns:eu-west-2:123456789012:street-manager-open-data",
  Message: JSON.stringify({ event_type: "WORK_START", object_data: { work_reference_number: "AB123" } }),
  Timestamp: "2026-10-05T12:01:00.000Z",
}, "1")
assert.equal(stringToSign(notification).includes("Subject"), false)
assert.equal(verifySnsSignature(notification, publicPem), true)

// --- Parsing ---
assert.deepEqual(parseSnsMessage(JSON.stringify(notification)), notification)
assert.equal(parseSnsMessage("not json"), null)
assert.equal(parseSnsMessage(JSON.stringify({ ...notification, Type: "Other" })), null)
assert.equal(parseSnsMessage(JSON.stringify({ ...notification, Signature: undefined })), null)

// --- Only SNS's own hosts are trusted ---
assert.equal(isSnsUrl(confirmation.SigningCertURL, CERT_PATH), true)
assert.equal(isSnsUrl("http://sns.eu-west-2.amazonaws.com/SimpleNotificationService-abc.pem", CERT_PATH), false)
assert.equal(isSnsUrl("https://sns.eu-west-2.amazonaws.com.evil.example/SimpleNotificationService-abc.pem", CERT_PATH), false)
assert.equal(isSnsUrl("https://evil.example/SimpleNotificationService-abc.pem", CERT_PATH), false)
assert.equal(isSnsUrl("https://sns.eu-west-2.amazonaws.com/other.pem", CERT_PATH), false)
assert.equal(isSnsUrl(confirmation.SubscribeURL ?? "", SUBSCRIBE_PATH), true)
assert.equal(isSnsUrl("https://sns.eu-west-2.amazonaws.com/x", SUBSCRIBE_PATH), false)

console.log("sns ok")
