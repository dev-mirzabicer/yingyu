"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ContentLibrary() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-slate-900">Content Library</h1>
      <Card>
        <CardHeader>
          <CardTitle>Under Construction</CardTitle>
        </CardHeader>
        <CardContent>
          <p>This feature is not yet implemented.</p>
        </CardContent>
      </Card>
    </div>
  );
}
