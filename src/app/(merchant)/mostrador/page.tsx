import type { Metadata } from "next";
import { CounterPos } from "@/components/mostrador/counter-pos";

export const metadata: Metadata = {
  title: "Mostrador",
  description: "Cobra en el mostrador con código QR o envío al celular.",
};

export default function MostradorPage() {
  return <CounterPos />;
}
