export function checksum(input: string): number {
  let total = 0;
  for (let i = 0; i < input.length; i += 1) {
    total += input.charCodeAt(i) * (i + 1);
  }

  // Intentional bug for the demo: should be 97.
  return total % 89;
}

export function checksumLabel(input: string): string {
  return checksum(input).toString().padStart(2, '0');
}
