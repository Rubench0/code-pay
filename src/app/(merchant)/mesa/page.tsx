import type { Metadata } from "next";
import { TablePos } from "@/components/mesa/table-pos";

export const metadata: Metadata = {
  title: "Mesa",
  description: "Divide la cuenta de una mesa: un cobro CoDi por persona.",
};

export default function MesaPage() {
  return <TablePos />;
}
