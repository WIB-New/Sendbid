/**
 * Stub Stripe PaymentSheet — remplacer par @stripe/stripe-react-native
 * quand le SDK Stripe est intégré au projet.
 */

export type InitPaymentSheetResult = { error?: { message: string; code?: string } };
export type PresentPaymentSheetResult = { error?: { message: string; code?: string } };

export type InitPaymentSheetParams = {
  paymentIntentClientSecret: string;
  merchantDisplayName: string;
  style?: "automatic" | "alwaysLight" | "alwaysDark";
  allowsDelayedPaymentMethods?: boolean;
  defaultBillingDetails?: {
    email?: string;
    name?: string;
  };
};

export async function initPaymentSheet(params: InitPaymentSheetParams): Promise<InitPaymentSheetResult> {
  // TODO: remplacer par initPaymentSheet de @stripe/stripe-react-native
  return { error: { message: "Stripe n'est pas encore configuré dans cette version.", code: "NotImplemented" } };
}

export async function presentPaymentSheet(): Promise<PresentPaymentSheetResult> {
  // TODO: remplacer par presentPaymentSheet de @stripe/stripe-react-native
  return { error: { message: "Stripe n'est pas encore configuré dans cette version.", code: "NotImplemented" } };
}
