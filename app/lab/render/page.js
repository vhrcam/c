import { notFound } from "next/navigation";
import LabRender from "@/components/LabRender";

export default function LabRenderPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <LabRender />;
}
