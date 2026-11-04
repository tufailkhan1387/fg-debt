import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowUpRight, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCurrentUser } from "@/lib/auth";
import { useResolveSolicitorTask, useSolicitorMattersFull } from "@/lib/matters-api";
import type { TaskItem } from "@/lib/solicitor-data";

type TaskFilter = "all" | "open" | "resolved";

type SolicitorTaskRow = TaskItem & {
  matterId: string;
  clientName: string;
};

function isOpenTask(task: TaskItem): boolean {
  return task.status !== "resolved";
}

function canResolveTask(task: TaskItem): boolean {
  return task.status === "client_completed" || task.status === "sent_to_client" || task.status === "overdue";
}

function statusBadgeVariant(status: TaskItem["status"]) {
  switch (status) {
    case "resolved":
      return "secondary";
    case "client_completed":
      return "default";
    case "overdue":
      return "destructive";
    default:
      return "outline";
  }
}

export function SolicitorTasksPage() {
  const { data, isLoading, isError } = useSolicitorMattersFull();
  const resolveTask = useResolveSolicitorTask();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<TaskFilter>("open");
  const solicitorName = getCurrentUser()?.name ?? "Solicitor";

  const tasks = useMemo<SolicitorTaskRow[]>(
    () =>
      (data?.matters ?? []).flatMap((matter) =>
        matter.tasks.map((task) => ({ ...task, matterId: matter.id, clientName: matter.clientName })),
      ),
    [data?.matters],
  );

  const filteredTasks = useMemo(() => {
    const sorted = [...tasks].sort((a, b) => {
      if (a.status === "resolved" && b.status !== "resolved") return 1;
      if (a.status !== "resolved" && b.status === "resolved") return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });

    if (filter === "open") return sorted.filter((task) => isOpenTask(task));
    if (filter === "resolved") return sorted.filter((task) => task.status === "resolved");
    return sorted;
  }, [filter, tasks]);

  const openCount = tasks.filter((task) => isOpenTask(task)).length;
  const resolvedCount = tasks.filter((task) => task.status === "resolved").length;

  const handleResolve = (task: SolicitorTaskRow) => {
    resolveTask.mutate(
      { matterId: task.matterId, taskId: task.id, solicitorName },
      {
        onSuccess: () => toast.success(`Task "${task.title}" resolved.`),
        onError: () => toast.error("Could not resolve task."),
      },
    );
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="size-8 animate-spin" />
      </div>
    );
  }

  if (isError) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Could not load tasks.</p>;
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight text-foreground sm:text-3xl">
            Tasks & Client Requests
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pending solicitor action items, document requests, and client clarifications.
          </p>
        </div>
        <Tabs value={filter} onValueChange={(value) => setFilter(value as TaskFilter)}>
          <TabsList>
            <TabsTrigger value="open">Open ({openCount})</TabsTrigger>
            <TabsTrigger value="all">All ({tasks.length})</TabsTrigger>
            <TabsTrigger value="resolved">Resolved ({resolvedCount})</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card className="surface-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-semibold">Task Title</TableHead>
                <TableHead className="text-xs font-semibold">Matter & Client</TableHead>
                <TableHead className="text-xs font-semibold">Type</TableHead>
                <TableHead className="text-xs font-semibold">Priority</TableHead>
                <TableHead className="text-xs font-semibold">Due Date</TableHead>
                <TableHead className="text-xs font-semibold">Status</TableHead>
                <TableHead className="text-xs font-semibold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    No tasks in this view.
                  </TableCell>
                </TableRow>
              ) : (
                filteredTasks.map((task) => (
                  <TableRow key={`${task.matterId}-${task.id}`} className="text-xs group hover:bg-muted/50">
                    <TableCell className="font-semibold">
                      <div>{task.title}</div>
                      <div className="text-[0.68rem] text-muted-foreground">{task.description}</div>
                      {task.clientResponse ? (
                        <div className="mt-1 text-[0.68rem] text-emerald-700 dark:text-emerald-300">
                          Client: {task.clientResponse}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-foreground">{task.clientName}</div>
                      <div className="text-[0.68rem] font-mono text-muted-foreground">{task.matterId}</div>
                    </TableCell>
                    <TableCell className="capitalize">{task.type.replace(/_/g, " ")}</TableCell>
                    <TableCell>
                      <Badge
                        variant={task.priority === "urgent" ? "destructive" : "secondary"}
                        className="text-[0.62rem] capitalize"
                      >
                        {task.priority} Priority
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono">{task.dueDate}</TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(task.status)} className="capitalize">
                        {task.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {canResolveTask(task) ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs"
                            disabled={resolveTask.isPending}
                            onClick={() => handleResolve(task)}
                          >
                            {resolveTask.isPending ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <>
                                <CheckCircle2 className="size-3.5 mr-1" />
                                Resolve
                              </>
                            )}
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigate({ to: `/solicitor/matters/${task.matterId}` as any })}
                          className="text-xs"
                        >
                          Open Matter <ArrowUpRight className="size-3.5 ml-1" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
