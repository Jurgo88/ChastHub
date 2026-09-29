import { randomBytes } from 'crypto'

export function generateLinkId(): string {
  return randomBytes(16).toString('hex')
}
