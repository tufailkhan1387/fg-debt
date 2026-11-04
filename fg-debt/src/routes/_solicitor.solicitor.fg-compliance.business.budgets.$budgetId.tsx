import { createFileRoute } from "@tanstack/react-router";
import { BudgetPage } from "@/components/compliance/BudgetPage";

export const Route = createFileRoute("/_solicitor/solicitor/fg-compliance/business/budgets/$budgetId")({
  head: () => ({
    meta: [{ title: "Budget — FG Compliance" }],
  }),
  component: BudgetRoute,
});

function BudgetRoute() {
  const { budgetId } = Route.useParams();
  return <BudgetPage key={budgetId} budgetId={budgetId} />;
}
