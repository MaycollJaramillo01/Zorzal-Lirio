export const ORDER_CODE_PATTERN = /^ZL-\d{4}-\d{4}$/;

export function validateOrderCode(code: string): boolean {
  return ORDER_CODE_PATTERN.test(code);
}
