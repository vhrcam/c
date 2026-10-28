import { notFound } from "next/navigation";
import Lab from "@/components/Lab";

export const metadata = { title: "lab · c" };

export default function LabPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Lab />;
}
