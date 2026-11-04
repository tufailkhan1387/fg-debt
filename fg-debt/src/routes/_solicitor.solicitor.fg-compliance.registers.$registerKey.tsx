import { createFileRoute } from "@tanstack/react-router";
import { RegisterPage } from "@/components/compliance/RegisterPage";

export const Route = createFileRoute("/_solicitor/solicitor/fg-compliance/registers/$registerKey")({
  head: () => ({
    meta: [{ title: "Register — FG Compliance" }],
  }),
  component: RegisterRoute,
});

function RegisterRoute() {
  const { registerKey } = Route.useParams();
  return <RegisterPage key={registerKey} registerKey={registerKey} />;
}
