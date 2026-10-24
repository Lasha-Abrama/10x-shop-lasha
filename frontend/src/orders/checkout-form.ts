// Demonstration form values stay in React memory; the order API does not store them.
export type CheckoutDetails = { fullName: string; email: string; address: string; city: string };
export type CheckoutErrors = Partial<Record<keyof CheckoutDetails, string>>;

export function validateCheckoutDetails(values: CheckoutDetails): CheckoutErrors {
  const errors: CheckoutErrors = {};
  if (values.fullName.trim().length < 3 || values.fullName.length > 100) errors.fullName = 'Enter your full name (3–100 characters).';
  if (values.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = 'Enter a valid email address.';
  if (values.address.trim().length < 5 || values.address.length > 200) errors.address = 'Enter an address (5–200 characters).';
  if (!values.city.trim() || values.city.length > 100) errors.city = 'Enter your city (up to 100 characters).';
  return errors;
}
