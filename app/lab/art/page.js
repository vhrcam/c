import { notFound } from "next/navigation";
import ArtLab from "@/components/ArtLab";

export const metadata = { title: "art lab · c" };

export default function ArtLabPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <ArtLab />;
}
