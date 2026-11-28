import PaymentResultPage from "./PaymentResultPage";

// Legacy /order/<reference> links now resolve to the verified database order.
export default function OrderPage({ reference }: { reference: string }) {
  return <PaymentResultPage status="confirmation" reference={reference} />;
}
