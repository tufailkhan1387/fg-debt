import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

export interface DocumentHelpGuide {
  category: string;
  title: string;
  body: string;
  required: number;
  uploaded: number;
  status: "complete" | "partial" | "missing" | "optional";
  tips: string[];
}

export interface DocumentHelpResult {
  matterId: string | null;
  guides: DocumentHelpGuide[];
  flaggedDocuments: { name: string; reason: string }[];
}

export function getDocumentHelpRequest() {
  return apiRequest<DocumentHelpResult>("/api/client/documents/help");
}

export function useDocumentHelp() {
  return useQuery({
    queryKey: ["client", "documents", "help"],
    queryFn: getDocumentHelpRequest,
  });
}
