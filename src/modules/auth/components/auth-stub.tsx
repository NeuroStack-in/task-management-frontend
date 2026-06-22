import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/** Lightweight placeholder for auth flows simulated in a later phase. */
export function AuthStub({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {children}
        <Button
          render={<Link href="/login" />}
          nativeButton={false}
          variant="outline"
          className="w-full"
        >
          Back to sign in
        </Button>
      </CardContent>
    </Card>
  );
}
