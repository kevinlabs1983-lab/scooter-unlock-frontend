function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  return data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength,
  ) as ArrayBuffer
}

const AES_CBC = { name: 'AES-CBC' } as const

function padTo16(input: Uint8Array): Uint8Array {
  const padded = new Uint8Array(16)
  padded.set(input.slice(0, 16))
  return padded
}

/**
 * Einzelblock-AES (ECB-Äquivalent via AES-CBC mit Null-IV).
 */
async function aesEcbBlock(
  key: CryptoKey,
  block: Uint8Array,
): Promise<Uint8Array> {
  const iv = new Uint8Array(16)
  const encrypted = await crypto.subtle.encrypt(
    { ...AES_CBC, iv },
    key,
    block.buffer.slice(block.byteOffset, block.byteOffset + 16) as ArrayBuffer,
  )
  return new Uint8Array(encrypted).slice(0, 16)
}

/**
 * Baut den 13-Byte-Nonce für CTR und CBC-MAC.
 * Layout: counter (BE32) || auth[0:8] || 0x00
 */
export function buildNonce(counter: number, authParam: Uint8Array): Uint8Array {
  const nonce = new Uint8Array(13)
  nonce[0] = (counter >> 24) & 0xff
  nonce[1] = (counter >> 16) & 0xff
  nonce[2] = (counter >> 8) & 0xff
  nonce[3] = counter & 0xff
  nonce.set(authParam.slice(0, 8), 4)
  return nonce
}

function buildABlock(nonce13: Uint8Array, blockIndex: number): Uint8Array {
  const block = new Uint8Array(16)
  block[0] = 0x01
  block.set(nonce13, 1)
  block[14] = 0x00
  block[15] = blockIndex & 0xff
  return block
}

function buildB0(nonce13: Uint8Array, payloadLen: number): Uint8Array {
  const block = new Uint8Array(16)
  block[0] = 0x59
  block.set(nonce13, 1)
  block[14] = 0x00
  block[15] = payloadLen & 0xff
  return block
}

async function importAesKey(key1: Uint8Array, key2: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = new Uint8Array(32)
  keyMaterial.set(padTo16(key1), 0)
  keyMaterial.set(padTo16(key2), 16)

  const digest = await crypto.subtle.digest('SHA-1', toArrayBuffer(keyMaterial))
  const rawKey = new Uint8Array(digest).slice(0, 16)

  return crypto.subtle.importKey(
    'raw',
    rawKey,
    AES_CBC,
    false,
    ['encrypt', 'decrypt'],
  )
}

/**
 * Leitet einen AES-128-Session-Key aus Gerätename und Challenge ab.
 *
 * Ninebot Encryption2 nutzt SHA-1(key1_pad16 || key2_pad16)[0:16] — kein HKDF,
 * aber funktional eine deterministische Key-Derivation aus Name + Challenge.
 *
 * @param deviceName - BLE-Name des Scooters
 * @param challenge - 16-Byte auth_param aus PRE_COMM
 */
export async function deriveSessionKey(
  deviceName: string,
  challenge: Uint8Array,
): Promise<CryptoKey> {
  return importAesKey(new TextEncoder().encode(deviceName), challenge)
}

/**
 * Leitet einen AES-128-Key aus zwei 16-Byte-Materialblöcken ab (z. B. Passwort + auth_param).
 */
export async function deriveKeyMaterial(
  key1: Uint8Array,
  key2: Uint8Array,
): Promise<CryptoKey> {
  return importAesKey(key1, key2)
}

/**
 * Berechnet den 4-Byte AES-128-CBC-MAC über einen Klartext-Frame.
 *
 * @param key - Session-Key
 * @param data - Vollständiger Klartext-Frame (Header + Payload)
 * @param authParam - auth_param für Nonce-Konstruktion
 * @param counter - Monoton steigender Session-Counter
 */
export async function computeMAC(
  key: CryptoKey,
  data: Uint8Array,
  authParam: Uint8Array,
  counter: number,
): Promise<Uint8Array> {
  const nonce13 = buildNonce(counter, authParam)
  const payloadLen = data.length - 3

  let x = await aesEcbBlock(key, buildB0(nonce13, payloadLen))

  const aad = new Uint8Array(16)
  aad.set(data.slice(0, 3))
  x = await aesEcbBlock(
    key,
    Uint8Array.from(x.map((byte, index) => byte ^ aad[index]!)),
  )

  const payload = data.slice(3)
  let offset = 0
  while (offset < payload.length) {
    const chunk = payload.slice(offset, offset + 16)
    const block = new Uint8Array(16)
    block.set(chunk)
    x = await aesEcbBlock(
      key,
      Uint8Array.from(x.map((byte, index) => byte ^ block[index]!)),
    )
    offset += 16
  }

  return x.slice(0, 4)
}

async function ctrXor(
  key: CryptoKey,
  data: Uint8Array,
  nonce13: Uint8Array,
  startBlock = 1,
): Promise<Uint8Array> {
  const out = new Uint8Array(data.length)
  let blockIndex = startBlock
  let offset = 0

  while (offset < data.length) {
    const keystream = await aesEcbBlock(key, buildABlock(nonce13, blockIndex))
    const chunkLen = Math.min(16, data.length - offset)
    for (let i = 0; i < chunkLen; i++) {
      out[offset + i] = data[offset + i]! ^ keystream[i]!
    }
    offset += chunkLen
    blockIndex++
  }

  return out
}

/**
 * Verschlüsselt Payload-Bytes mit AES-128-CTR (Ninebot SN-Modus).
 *
 * @param key - Session-Key
 * @param counter - Monoton steigender Counter (Replay-Schutz)
 * @param plaintext - Zu verschlüsselnde Bytes (typisch Frame ab Byte 3)
 * @param authParam - auth_param für Nonce-Konstruktion
 */
export async function encryptFrame(
  key: CryptoKey,
  counter: number,
  plaintext: Uint8Array,
  authParam: Uint8Array,
): Promise<Uint8Array> {
  return ctrXor(key, plaintext, buildNonce(counter, authParam))
}

/**
 * Entschlüsselt Payload-Bytes mit AES-128-CTR (Ninebot SN-Modus).
 *
 * @param key - Session-Key
 * @param counter - Counter aus empfangenem Frame
 * @param ciphertext - Verschlüsselte Bytes
 * @param authParam - auth_param für Nonce-Konstruktion
 */
export async function decryptFrame(
  key: CryptoKey,
  counter: number,
  ciphertext: Uint8Array,
  authParam: Uint8Array,
): Promise<Uint8Array> {
  return ctrXor(key, ciphertext, buildNonce(counter, authParam))
}

/**
 * Verschlüsselt einen Klartext-Frame für den BLE-Transport (SN-Modus).
 * Gibt `[Header(3) | Ciphertext | Tag(4) | Counter(2)]` zurück.
 */
export async function wrapEncryptedFrame(
  key: CryptoKey,
  counter: number,
  plaintext: Uint8Array,
  authParam: Uint8Array,
): Promise<{ wire: Uint8Array; nextCounter: number }> {
  const nextCounter = counter + 1
  const header = plaintext.slice(0, 3)
  const payload = plaintext.slice(3)
  const nonce13 = buildNonce(nextCounter, authParam)

  const tag = await computeMAC(key, plaintext, authParam, nextCounter)
  const ciphertext = await ctrXor(key, payload, nonce13)
  const a0Keystream = await aesEcbBlock(key, buildABlock(nonce13, 0))
  const encTag = Uint8Array.from(tag.map((byte, index) => byte ^ a0Keystream[index]!))

  const ctrTail = new Uint8Array(2)
  ctrTail[0] = (nextCounter >> 8) & 0xff
  ctrTail[1] = nextCounter & 0xff

  const wire = new Uint8Array(3 + ciphertext.length + 4 + 2)
  wire.set(header, 0)
  wire.set(ciphertext, 3)
  wire.set(encTag, 3 + ciphertext.length)
  wire.set(ctrTail, wire.length - 2)

  return { wire, nextCounter }
}

/**
 * Entschlüsselt einen empfangenen BLE-Frame (SN-Modus).
 */
export async function unwrapEncryptedFrame(
  key: CryptoKey,
  counter: number,
  cipherframe: Uint8Array,
  authParam: Uint8Array,
): Promise<{ plaintext: Uint8Array; recvCounter: number }> {
  const header = cipherframe.slice(0, 3)
  const tail = cipherframe.slice(-6)
  const encBody = cipherframe.slice(3, -6)
  const recvCounter = (tail[4]! << 8) | tail[5]!
  const nonce13 = buildNonce(recvCounter, authParam)

  const plaintextPayload = await ctrXor(key, encBody, nonce13)
  const plaintext = new Uint8Array(3 + plaintextPayload.length)
  plaintext.set(header, 0)
  plaintext.set(plaintextPayload, 3)

  const encTag = tail.slice(0, 4)
  const a0Keystream = await aesEcbBlock(key, buildABlock(nonce13, 0))
  const recvTag = Uint8Array.from(
    encTag.map((byte, index) => byte ^ a0Keystream[index]!),
  )
  const expectedTag = await computeMAC(key, plaintext, authParam, recvCounter)

  if (!recvTag.every((byte, index) => byte === expectedTag[index])) {
    throw new Error('MAC-Verifikation fehlgeschlagen')
  }

  return { plaintext, recvCounter: Math.max(counter, recvCounter) }
}

/**
 * Verschlüsselt einen Frame vor dem SN-Modus (Handshake Phase 1).
 */
export async function encryptBootstrapFrame(
  key: CryptoKey,
  plaintext: Uint8Array,
  ecbInput: Uint8Array,
): Promise<Uint8Array> {
  const header = plaintext.slice(0, 3)
  const payload = plaintext.slice(3)
  const keystream = await aesEcbBlock(key, padTo16(ecbInput))

  const encryptedPayload = new Uint8Array(payload.length)
  let offset = 0
  while (offset < payload.length) {
    const chunkLen = Math.min(16, payload.length - offset)
    for (let i = 0; i < chunkLen; i++) {
      encryptedPayload[offset + i] = payload[offset + i]! ^ keystream[i]!
    }
    offset += chunkLen
  }

  let checksum = 0
  for (const byte of payload) {
    checksum = (checksum + byte) & 0xffff
  }
  checksum = (~checksum) & 0xffff

  const wire = new Uint8Array(3 + encryptedPayload.length + 6)
  wire.set(header, 0)
  wire.set(encryptedPayload, 3)
  wire[wire.length - 6] = 0x00
  wire[wire.length - 5] = 0x00
  wire[wire.length - 4] = checksum & 0xff
  wire[wire.length - 3] = (checksum >> 8) & 0xff
  wire[wire.length - 2] = 0x00
  wire[wire.length - 1] = 0x00
  return wire
}

/**
 * Entschlüsselt einen Bootstrap-Frame (Handshake Phase 1).
 */
export async function decryptBootstrapFrame(
  key: CryptoKey,
  cipherframe: Uint8Array,
  ecbInput: Uint8Array,
): Promise<Uint8Array> {
  const header = cipherframe.slice(0, 3)
  const tail = cipherframe.slice(-6)
  const encBody = cipherframe.slice(3, -6)
  const keystream = await aesEcbBlock(key, padTo16(ecbInput))

  const payload = new Uint8Array(encBody.length)
  let offset = 0
  while (offset < encBody.length) {
    const chunkLen = Math.min(16, encBody.length - offset)
    for (let i = 0; i < chunkLen; i++) {
      payload[offset + i] = encBody[offset + i]! ^ keystream[i]!
    }
    offset += chunkLen
  }

  let expectedChecksum = 0
  for (const byte of payload) {
    expectedChecksum = (expectedChecksum + byte) & 0xffff
  }
  expectedChecksum = (~expectedChecksum) & 0xffff
  const recvChecksum = tail[2]! | (tail[3]! << 8)
  if (expectedChecksum !== recvChecksum) {
    throw new Error('Bootstrap-Checksum ungültig')
  }

  const plaintext = new Uint8Array(3 + payload.length)
  plaintext.set(header, 0)
  plaintext.set(payload, 3)
  return plaintext
}

const JAVA_MASK = (1n << 48n) - 1n
const JAVA_MULT = 0x5deece66dn
const JAVA_ADD = 0xbn

function javaInt(value: number): number {
  const truncated = value & 0xffffffff
  return truncated >= 0x80000000 ? truncated - 0x100000000 : truncated
}

function javaLong(value: number): number {
  const truncated = Number(BigInt(value) & ((1n << 64n) - 1n))
  return truncated >= 0x8000000000000000 ? truncated - 0x10000000000000000 : truncated
}

class JavaRandom {
  private seed: bigint

  constructor(seed: number) {
    this.seed = (BigInt(seed) ^ JAVA_MULT) & JAVA_MASK
  }

  private next(bits: number): number {
    this.seed = (this.seed * JAVA_MULT + JAVA_ADD) & JAVA_MASK
    return Number(this.seed >> BigInt(48 - bits))
  }

  nextBytes(length: number): Uint8Array {
    const out = new Uint8Array(length)
    let index = 0
    while (index < length) {
      const rnd = this.next(32)
      for (let j = 0; j < 4 && index < length; j++) {
        out[index] = (rnd >> (8 * j)) & 0xff
        index++
      }
    }
    return out
  }
}

/**
 * Erzeugt das 16-Byte Session-Passwort aus auth_param (Ninebot Java-Logik).
 */
export async function generateSessionPassword(
  authParam: Uint8Array,
  timeMs = Date.now(),
): Promise<Uint8Array> {
  let seedPart = 0
  authParam.forEach((byte, index) => {
    const signed = byte >= 128 ? byte - 256 : byte
    const shift = ((index % 8) * 8) & 31
    seedPart = javaLong(seedPart + javaInt(signed << shift))
  })

  const seed = javaLong(timeMs + seedPart)
  const randomBytes = new JavaRandom(seed).nextBytes(16)
  const digest = await crypto.subtle.digest('SHA-256', toArrayBuffer(randomBytes))
  return new Uint8Array(digest).slice(0, 16)
}

/**
 * Leitet das AUTH-Token aus Session-Passwort und auth_param ab.
 */
export async function deriveAuthToken(
  password: Uint8Array,
  authParam: Uint8Array,
): Promise<Uint8Array> {
  const material = new Uint8Array(32)
  material.set(padTo16(password), 0)
  material.set(padTo16(authParam), 16)
  const digest = await crypto.subtle.digest('SHA-256', toArrayBuffer(material))
  return new Uint8Array(digest).slice(0, 16)
}
