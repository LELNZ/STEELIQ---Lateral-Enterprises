import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LayoutGrid, Plus, Trash2, FolderOpen, Calendar, MapPin, Square } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Job } from "@shared/schema";

type JobWithCount = Job & { itemCount: number; totalSqm: number };

export default function JobsList() {
  const { toast } = useToast();
  const { data: jobs = [], isLoading } = useQuery<JobWithCount[]>({
    queryKey: ["/api/jobs"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/jobs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Job deleted" });
    },
  });

  return (
    <div className="flex flex-col h-full bg-background" data-testid="jobs-list">
      <header className="border-b px-6 py-3 flex items-center justify-between gap-4 bg-card shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary">
            <LayoutGrid className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight" data-testid="text-app-title">
              Pro-Quote CAD Generator
            </h1>
            <p className="text-xs text-muted-foreground">Manage your quotation jobs</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/job/new">
            <Button data-testid="button-new-job">
              <Plus className="w-4 h-4 mr-2" /> New Job
            </Button>
          </Link>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Loading jobs...</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4" data-testid="empty-jobs">
            <FolderOpen className="w-12 h-12 text-muted-foreground/50" />
            <p className="text-muted-foreground text-lg">No jobs yet</p>
            <Link href="/job/new">
              <Button data-testid="button-create-first-job">
                <Plus className="w-4 h-4 mr-2" /> Create your first job
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 max-w-4xl mx-auto">
            {jobs.map((job) => (
              <Card key={job.id} data-testid={`card-job-${job.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base" data-testid={`text-job-name-${job.id}`}>
                      {job.name}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {job.totalSqm > 0 && (
                        <Badge variant="outline" data-testid={`badge-sqm-${job.id}`}>
                          <Square className="w-3 h-3 mr-1" />
                          {job.totalSqm} m²
                        </Badge>
                      )}
                      <Badge variant="secondary" data-testid={`badge-item-count-${job.id}`}>
                        {job.itemCount} item{job.itemCount !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                    {job.address && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" /> {job.address}
                      </span>
                    )}
                    {job.date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" /> {job.date}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/job/${job.id}`}>
                      <Button size="sm" data-testid={`button-open-job-${job.id}`}>
                        <FolderOpen className="w-3.5 h-3.5 mr-1.5" /> Open
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteMutation.mutate(job.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-job-${job.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
