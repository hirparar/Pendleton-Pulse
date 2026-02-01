import { Button } from "@/components/ui/button";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function Home() {

  const { userId, orgId } = await auth();

  console.log("dashboard page", userId, orgId);

  if (!userId) redirect("/sign-in");

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <Button variant={"link"}>
          Main Page
        </Button>
      </main>
    </div>
  );
}
