// Demonstration form values stay in React memory; the order API does not store them.
export type CheckoutDetails = { fullName: string; email: string; address: string; city: string };
export type CheckoutErrors = Partial<Record<keyof CheckoutDetails, string>>;

export function validateCheckoutDetails(values: CheckoutDetails): CheckoutErrors {
  const errors: CheckoutErrors = {};
  if (values.fullName.trim().length < 3 || values.fullName.length > 100) errors.fullName = 'Full name must be at least 3 characters';
  if (values.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = 'Please enter a valid email address';
  if (values.address.trim().length < 5 || values.address.length > 200) errors.address = 'Address must be at least 5 characters';
  if (!values.city.trim() || values.city.length > 100) errors.city = 'City is required';
  return errors;
}
