const digits = (s: string) => s.replace(/\D/g, '');

/**
 * Whether the counterparty is the owner's own wallet. Numbers compare on their last nine digits
 * so `0244...` and `233244...` agree; names compare case-insensitively.
 */
export function isSelfTransfer(
  counterparty: { name: string | null; number: string | null },
  owner: { number: string | null; name: string | null },
): boolean {
  const own = owner.number === null ? '' : digits(owner.number);
  const theirs = counterparty.number === null ? '' : digits(counterparty.number);
  if (own.length >= 9 && theirs.length >= 9 && own.slice(-9) === theirs.slice(-9)) return true;
  const ownName = owner.name?.trim().toLowerCase().replace(/\s+/g, ' ') ?? '';
  const theirName = counterparty.name?.trim().toLowerCase().replace(/\s+/g, ' ') ?? '';
  return ownName !== '' && ownName === theirName;
}
