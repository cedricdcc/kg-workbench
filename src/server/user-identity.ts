import crypto from "node:crypto"
import { cookies } from "next/headers"

export const USER_ID_COOKIE_NAME = "kg-workbench-user-id"

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isValidUserId(id: unknown): boolean {
  if (typeof id !== "string") {
    return false
  }
  return UUID_REGEX.test(id.trim())
}

/**
 * Read the persistent client identifier from cookies if present and valid.
 */
export async function getUserIdFromCookies(): Promise<string | null> {
  try {
    const cookieStore = await cookies()
    const value = cookieStore.get(USER_ID_COOKIE_NAME)?.value
    if (value && isValidUserId(value)) {
      return value.trim()
    }
  } catch {
    // cookies() might not be available in non-request contexts
  }
  return null
}

/**
 * Retrieve the current persistent client user ID or issue a new UUID v4.
 */
export async function getOrCreateUserId(): Promise<string> {
  const existingId = await getUserIdFromCookies()
  if (existingId) {
    return existingId
  }

  const newId = crypto.randomUUID()
  try {
    const cookieStore = await cookies()
    cookieStore.set({
      name: USER_ID_COOKIE_NAME,
      value: newId,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 year
      secure: process.env.NODE_ENV === "production",
    })
  } catch {
    // If called in a context where cookies cannot be written, return the generated id
  }

  return newId
}
